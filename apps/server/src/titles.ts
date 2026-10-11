import { Readable } from "node:stream";
import chain from "stream-chain";
import { parser } from "stream-json";
import { streamObject } from "stream-json/streamers/stream-object.js";
import { db, getSetting, setSetting } from "./db";

export type Kind = "base" | "update" | "dlc" | "unknown";

export const GAME_EXTENSIONS = [".nsp", ".nsz", ".xci", ".xcz"];
export const isGameFile = (name: string) =>
  GAME_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

const hex16 = (n: bigint) => n.toString(16).toUpperCase().padStart(16, "0");

/**
 * Extracts title metadata from the usual dump naming convention:
 * "Game Name [0100ABCD12340000][v0].nsp".
 * Base titles end in 000, updates in 800, DLCs live at base + 0x1000 + n.
 */
export function parseFileName(name: string) {
  const titleId = name.match(/\[([0-9a-fA-F]{16})\]/)?.[1]?.toUpperCase() ?? null;
  const versionMatch = name.match(/\[v(\d+)\]/i);
  const version = versionMatch ? Number(versionMatch[1]) : null;

  let kind: Kind = "unknown";
  let baseId: string | null = null;
  if (titleId) {
    const n = BigInt(`0x${titleId}`);
    const low = n & 0xfffn;
    const masked = n & ~0xfffn;
    if (low === 0n) {
      kind = "base";
      baseId = titleId;
    } else if (low === 0x800n) {
      kind = "update";
      baseId = hex16(masked);
    } else {
      kind = "dlc";
      baseId = hex16(masked - 0x1000n);
    }
  }
  return { titleId, baseId, version, kind };
}

interface TitleDbEntry {
  id?: string | null;
  name?: string | null;
  publisher?: string | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  releaseDate?: number | string | null;
  category?: string[] | null;
  description?: string | null;
  screenshots?: string[] | null;
  developer?: string | null;
  numberOfPlayers?: number | null;
}

export interface TitleDbStatus {
  state: "idle" | "running" | "done" | "error";
  count?: number;
  updatedAt?: number;
  error?: string;
}

export const titleDbStatus = () => getSetting<TitleDbStatus>("titledb", { state: "idle" });

const TITLEDB_URL = "https://raw.githubusercontent.com/blawar/titledb/master/US.en.json";
let running = false;
/** Notified after a successful refresh (e.g. to rebuild search indexes). */
export const titleDbListeners = new Set<() => void>();

/** Streams the ~90MB titledb file and keeps only what the UI needs. */
export async function refreshTitleDb() {
  if (running) return;
  running = true;
  setSetting("titledb", { ...titleDbStatus(), state: "running" });
  try {
    const res = await fetch(TITLEDB_URL);
    if (!res.ok || !res.body) throw new Error(`titledb respondeu ${res.status}`);

    // Import into a staging table and swap at the end, so the library keeps its
    // covers during the download and survives a failed import.
    db.exec(`DROP TABLE IF EXISTS titles_import;
      CREATE TABLE titles_import (
        id TEXT PRIMARY KEY, name TEXT, publisher TEXT, icon_url TEXT, banner_url TEXT, release_date TEXT,
        categories TEXT, description TEXT, screenshots TEXT, developer TEXT, players INTEGER, raw TEXT
      );`);
    const insert = db.prepare(
      `INSERT INTO titles_import AS titles (id, name, publisher, icon_url, banner_url, release_date, categories, description, screenshots, developer, players, raw)
       VALUES (@id, @name, @publisher, @icon, @banner, @release, @categories, @description, @screenshots, @developer, @players, @raw)
       -- titledb lists bundles and editions under the same ID: keep the shortest name
       -- (the game itself) and fill gaps from the other entries.
       ON CONFLICT(id) DO UPDATE SET
         name = CASE WHEN titles.name IS NULL OR length(excluded.name) < length(titles.name) THEN excluded.name ELSE titles.name END,
         publisher = COALESCE(titles.publisher, excluded.publisher),
         icon_url = CASE WHEN titles.name IS NULL OR length(excluded.name) < length(titles.name)
                    THEN COALESCE(excluded.icon_url, titles.icon_url) ELSE COALESCE(titles.icon_url, excluded.icon_url) END,
         banner_url = CASE WHEN titles.name IS NULL OR length(excluded.name) < length(titles.name)
                    THEN COALESCE(excluded.banner_url, titles.banner_url) ELSE COALESCE(titles.banner_url, excluded.banner_url) END,
         release_date = COALESCE(titles.release_date, excluded.release_date),
         categories = COALESCE(titles.categories, excluded.categories),
         description = COALESCE(titles.description, excluded.description),
         screenshots = COALESCE(titles.screenshots, excluded.screenshots),
         developer = COALESCE(titles.developer, excluded.developer),
         players = COALESCE(titles.players, excluded.players),
         raw = CASE WHEN titles.name IS NULL OR length(excluded.name) < length(titles.name) THEN excluded.raw ELSE titles.raw END`,
    );
    const flush = db.transaction((rows: Record<string, unknown>[]) => {
      for (const row of rows) insert.run(row);
    });

    let batch: Record<string, unknown>[] = [];
    let count = 0;
    const pipeline = chain([
      Readable.fromWeb(res.body as import("node:stream/web").ReadableStream),
      parser(),
      streamObject<TitleDbEntry>(),
      ({ value }: { value: TitleDbEntry }) => {
        if (!value?.id || !/^[0-9A-Fa-f]{16}$/.test(value.id)) return;
        batch.push({
          id: value.id.toUpperCase(),
          name: value.name ?? null,
          publisher: value.publisher ?? null,
          icon: value.iconUrl ?? null,
          banner: value.bannerUrl ?? null,
          release: value.releaseDate != null ? String(value.releaseDate) : null,
          categories: value.category?.length ? JSON.stringify(value.category) : null,
          description: value.description ?? null,
          screenshots: value.screenshots?.length ? JSON.stringify(value.screenshots) : null,
          developer: value.developer ?? null,
          players: value.numberOfPlayers ?? null,
          // Full entry, handed to Tinfoil as-is in the store index.
          raw: JSON.stringify(value),
        });
        count++;
        if (batch.length >= 2000) {
          flush(batch);
          batch = [];
        }
      },
    ]);

    await new Promise<void>((resolve, reject) => {
      pipeline.on("error", reject);
      pipeline.on("finish", resolve);
      pipeline.on("end", resolve);
      pipeline.resume();
    });
    if (batch.length) flush(batch);
    db.transaction(() => {
      db.exec(`DELETE FROM titles;
        INSERT INTO titles (id, name, publisher, icon_url, banner_url, release_date, categories, description, screenshots, developer, players, raw)
        SELECT id, name, publisher, icon_url, banner_url, release_date, categories, description, screenshots, developer, players, raw FROM titles_import;
        DROP TABLE titles_import;`);
    })();
    setSetting("titledb", { state: "done", count, updatedAt: Date.now() });
    titleDbListeners.forEach((fn) => fn());
  } catch (err) {
    setSetting("titledb", {
      ...titleDbStatus(),
      state: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    running = false;
  }
}

export function lookupTitles(ids: string[]) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT id, name, publisher, icon_url AS iconUrl, banner_url AS bannerUrl FROM titles WHERE id IN (${placeholders})`,
    )
    .all(...ids.map((id) => id.toUpperCase())) as {
    id: string;
    name: string | null;
    publisher: string | null;
    iconUrl: string | null;
    bannerUrl: string | null;
  }[];
}
