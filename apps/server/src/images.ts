import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { db } from "./db";
import { env } from "./env";

/**
 * Cover art for Tinfoil, served by this server. Consoles often block Nintendo's
 * CDN through DNS (90DNS and friends), so the store fetches each image once and
 * keeps it on disk, resized: Tinfoil downloads Nintendo's 1024px originals but
 * doesn't display them.
 */

const SIZES: Record<ImageKind, { width: number; height?: number }> = {
  icon: { width: 256, height: 256 },
  banner: { width: 640 },
  boxart: { width: 300 },
};
// Bump when the output format changes so old cache files are ignored.
const CACHE_VERSION = 2;

const CACHE_DIR = join(env.dataDir, "cache", "images");
export type ImageKind = "icon" | "banner" | "boxart";

const inflight = new Map<string, Promise<{ body: Buffer; type: string } | null>>();

export function cachedImage(titleId: string, kind: ImageKind) {
  const key = `${titleId}-${kind}`;
  let pending = inflight.get(key);
  if (!pending) {
    pending = load(titleId, kind).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}

async function load(titleId: string, kind: ImageKind) {
  const file = join(CACHE_DIR, `${titleId}-${kind}-v${CACHE_VERSION}.jpg`);
  if (existsSync(file)) {
    const body = await readFile(file);
    return { body, type: sniff(body) };
  }
  const row = db.prepare("SELECT icon_url AS icon, banner_url AS banner, raw FROM titles WHERE id = ?").get(titleId) as
    | { icon: string | null; banner: string | null; raw: string | null }
    | undefined;
  const url =
    kind === "boxart" ? ((row?.raw ? JSON.parse(row.raw).frontBoxArt : null) as string | null) : row?.[kind];
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const original = Buffer.from(await res.arrayBuffer());
  // Plain baseline JPEG, no EXIF: the safest format for the console's image decoder.
  const body = await sharp(original)
    .resize({ ...SIZES[kind], fit: "cover" })
    .flatten({ background: "#000000" })
    .jpeg({ quality: 85, progressive: false, mozjpeg: false })
    .toBuffer();
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, body);
  return { body, type: sniff(body) };
}

function sniff(body: Buffer) {
  if (body[0] === 0x89 && body[1] === 0x50) return "image/png";
  if (body[0] === 0x52 && body[1] === 0x49) return "image/webp";
  return "image/jpeg";
}
