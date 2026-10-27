import { extname } from "node:path";
import { db } from "./db";
import type { Driver } from "./drivers/types";
import { parseFileName, titleDbListeners, type Kind } from "./titles";

/**
 * Identifies game files whose names lack a title ID.
 *  1. File header: NSP/NSZ are PFS0 archives. A "<rightsId>.tik" entry carries the
 *     title ID in its first 16 hex chars; a plaintext ".cnmt.xml" (when present) also
 *     carries the version. Only the first KB of the file are read.
 *  2. Name: fuzzy match against titledb names (trigram similarity + word overlap).
 */

export interface Candidate {
  titleId: string;
  name: string;
  iconUrl: string | null;
  kind: Kind;
  score: number;
}

export interface Identification {
  source: "name" | "cnmt" | "ticket" | "fuzzy" | "none";
  confidence: "high" | "medium" | "low";
  titleId: string | null;
  kind: Kind;
  version: number | null;
  /** Update without a known version: the user must type it before renaming. */
  needsVersion: boolean;
  title: { id: string; name: string; iconUrl: string | null } | null;
  candidates: Candidate[];
  suggestedName: string | null;
}

/* ---------- Layer 1: PFS0 header ---------- */

const HEADER_BYTES = 64 * 1024;

interface Pfs0Entry {
  name: string;
  offset: number;
  size: number;
}

/** Parses a PFS0 header. Returns null for anything else (XCI, NCZ-less garbage, sparse test files). */
export function parsePfs0(buf: Uint8Array) {
  if (buf.length < 16 || String.fromCharCode(...buf.subarray(0, 4)) !== "PFS0") return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const count = view.getUint32(4, true);
  const stringTableSize = view.getUint32(8, true);
  if (count === 0 || count > 1000) return null;
  const stringsStart = 0x10 + count * 0x18;
  const dataStart = stringsStart + stringTableSize;
  if (stringsStart > buf.length) return null;
  const entries: Pfs0Entry[] = [];
  for (let i = 0; i < count; i++) {
    const base = 0x10 + i * 0x18;
    if (base + 0x18 > buf.length) break;
    const offset = Number(view.getBigUint64(base, true));
    const size = Number(view.getBigUint64(base + 8, true));
    const nameOffset = view.getUint32(base + 16, true);
    let end = stringsStart + nameOffset;
    while (end < buf.length && buf[end] !== 0) end++;
    const name = new TextDecoder().decode(buf.subarray(stringsStart + nameOffset, end));
    entries.push({ name, offset: dataStart + offset, size });
  }
  return { entries, dataStart };
}

export function parseCnmtXml(xml: string) {
  const id = xml.match(/<Id>\s*0x([0-9a-fA-F]{16})\s*<\/Id>/)?.[1]?.toUpperCase() ?? null;
  const version = xml.match(/<Version>\s*(\d+)\s*<\/Version>/)?.[1];
  return { titleId: id, version: version ? Number(version) : null };
}

async function readRange(driver: Driver, remoteId: string, start: number, end: number) {
  const stream = await driver.read(remoteId, { start, end });
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = stream.getReader();
  while (total < end - start + 1) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => {});
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out.subarray(0, end - start + 1);
}

export interface HeaderInfo {
  titleId: string | null;
  version: number | null;
  source: "cnmt" | "ticket" | null;
}

export async function readHeader(driver: Driver, remoteId: string, size: number): Promise<HeaderInfo> {
  const none: HeaderInfo = { titleId: null, version: null, source: null };
  if (size < 16) return none;
  const head = await readRange(driver, remoteId, 0, Math.min(size, HEADER_BYTES) - 1);
  const pfs = parsePfs0(head);
  if (!pfs) return none;

  const cnmt = pfs.entries.find((e) => e.name.toLowerCase().endsWith(".cnmt.xml"));
  if (cnmt && cnmt.size < 256 * 1024 && cnmt.offset + cnmt.size <= size) {
    const xml = new TextDecoder().decode(await readRange(driver, remoteId, cnmt.offset, cnmt.offset + cnmt.size - 1));
    const parsed = parseCnmtXml(xml);
    if (parsed.titleId) return { ...parsed, source: "cnmt" };
  }
  const tik = pfs.entries.find((e) => /^[0-9a-f]{32}\.tik$/i.test(e.name));
  if (tik) return { titleId: tik.name.slice(0, 16).toUpperCase(), version: null, source: "ticket" };
  return none;
}

/* ---------- Layer 2: fuzzy name match ---------- */

interface IndexEntry {
  id: string;
  name: string;
  iconUrl: string | null;
  kind: Kind;
  grams: number;
  tokens: Set<string>;
}

let index: { entries: IndexEntry[]; postings: Map<string, number[]> } | null = null;

titleDbListeners.add(() => {
  index = null;
});

export function normalize(s: string) {
  return s
    .replace(/[™®©]/g, " ") // before NFKD, which would turn ™ into "TM"
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const NOISE = new Set([
  "nsp", "nsz", "xci", "xcz", "switch", "nsw", "ns", "eshop", "usa", "eur", "jpn", "us", "eu", "jp", "multi",
  "update", "upd", "patch", "dlc", "base", "game", "rev", "nintendo", "full", "repack", "trimmed", "the",
  "backup", "bkp", "dump", "dumped", "copia", "copy",
]);

function trigrams(s: string) {
  const padded = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

function buildIndex() {
  const rows = db
    .prepare(`SELECT id, name, icon_url AS iconUrl FROM titles WHERE name IS NOT NULL AND name != '' AND id NOT LIKE '%800'`)
    .all() as { id: string; name: string; iconUrl: string | null }[];
  const entries: IndexEntry[] = [];
  const postings = new Map<string, number[]>();
  for (const row of rows) {
    // Edition suffixes ("- Nintendo Switch 2 Edition") never appear in dump names.
    const norm = normalize(row.name.replace(/\s*[-–—:]\s*Nintendo Switch\s*2 Edition$/i, ""));
    if (!norm) continue;
    const grams = trigrams(norm);
    const i = entries.length;
    entries.push({
      id: row.id,
      name: row.name,
      iconUrl: row.iconUrl,
      kind: parseFileName(`[${row.id}]`).kind,
      grams: grams.size,
      tokens: new Set(norm.split(" ").filter((t) => !NOISE.has(t))),
    });
    for (const g of grams) {
      let list = postings.get(g);
      if (!list) postings.set(g, (list = []));
      list.push(i);
    }
  }
  return { entries, postings };
}

/** Turns a messy file name into a search query plus hints about what the file is. */
export function queryFromFileName(name: string) {
  const ext = extname(name);
  let base = name.slice(0, name.length - ext.length);
  // Dotted versions ("v1.0.0") show up on base dumps too, so they don't imply an update.
  base = base.replace(/_+/g, " ");
  const raw = base
    .toLowerCase()
    .replace(/\bv?\d+\.\d+(\.\d+)*\b/g, " ")
    .replace(/\.+/g, " ");
  const isUpdate = /\b(update|upd|patch)\b/.test(raw) || /\bv([1-9]\d*)\b/.test(raw);
  const isDlc = /\bdlc\b/.test(raw);
  const versionInt = name.match(/\[v(\d+)\]/i)?.[1];
  base = base
    .replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g, " ")
    .replace(/\bv?\d+\.\d+(\.\d+)*\b/gi, " ")
    .replace(/\.+/g, " ")
    .replace(/\bv\d+\b/gi, " ");
  const tokens = normalize(base)
    .split(" ")
    .filter((t) => t && !NOISE.has(t));
  return {
    query: tokens.join(" "),
    tokens,
    hint: (isDlc ? "dlc" : isUpdate ? "update" : "base") as Kind,
    version: versionInt ? Number(versionInt) : null,
  };
}

export function searchTitles(query: string, hint: Kind = "base", limit = 5): Candidate[] {
  const norm = normalize(query);
  if (norm.length < 2) return [];
  index ??= buildIndex();
  const grams = trigrams(norm);
  const shared = new Map<number, number>();
  for (const g of grams) {
    for (const i of index.postings.get(g) ?? []) shared.set(i, (shared.get(i) ?? 0) + 1);
  }
  const qTokens = norm.split(" ").filter((t) => t && !NOISE.has(t));
  const scored: Candidate[] = [];
  for (const [i, count] of shared) {
    const e = index.entries[i];
    const dice = (2 * count) / (grams.size + e.grams);
    const hits = qTokens.filter((t) => e.tokens.has(t)).length;
    const recall = qTokens.length ? hits / qTokens.length : 0;
    // Share of the title's own words present in the query: favours "Hollow Knight" over "Hollow World: Dark Knight".
    const precision = e.tokens.size ? hits / e.tokens.size : 0;
    let score = 0.5 * dice + 0.3 * recall + 0.2 * precision;
    // DLC entries reuse the game name; only favour them when the file looks like a DLC.
    if (e.kind === "dlc" && hint !== "dlc") score *= 0.8;
    if (e.kind === "base" && hint === "dlc") score *= 0.9;
    if (/\b(demo|kiosk|trial)\b/i.test(e.name) && !/\b(demo|kiosk|trial)\b/.test(norm)) score *= 0.7;
    scored.push({ titleId: e.id, name: e.name, iconUrl: e.iconUrl, kind: e.kind, score: Math.min(1, score) });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/* ---------- Putting it together ---------- */

const pretty = (name: string) =>
  name
    .replace(/[™®©]/g, "")
    .replace(/\s*[-–—:]\s*Nintendo Switch\s*2 Edition$/i, "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

function titleRow(id: string) {
  return db.prepare("SELECT id, name, icon_url AS iconUrl FROM titles WHERE id = ?").get(id) as
    | { id: string; name: string | null; iconUrl: string | null }
    | undefined;
}

/** Standard dump name: "Name [TITLEID][vVERSION].ext". */
export function buildFileName(titleId: string, version: number | null, ext: string, fallbackName?: string) {
  const meta = parseFileName(`[${titleId}]`);
  const own = titleRow(titleId);
  const base = meta.baseId ? titleRow(meta.baseId) : undefined;
  let name = pretty(base?.name ?? own?.name ?? fallbackName ?? "Game");
  if (meta.kind === "dlc" && own?.name) name = pretty(own.name);
  const v = version ?? (meta.kind === "update" ? null : 0);
  return `${name} [${titleId}]${v !== null ? `[v${v}]` : ""}${ext.toLowerCase()}`;
}

function finish(
  partial: Pick<Identification, "source" | "confidence" | "titleId" | "version" | "candidates">,
  fileName: string,
): Identification {
  const ext = extname(fileName) || ".nsp";
  if (!partial.titleId) {
    return { ...partial, kind: "unknown", needsVersion: false, title: null, suggestedName: null };
  }
  const meta = parseFileName(`[${partial.titleId}]`);
  const version = partial.version ?? (meta.kind === "update" ? null : 0);
  const display = titleRow(meta.kind === "dlc" ? partial.titleId : (meta.baseId ?? partial.titleId)) ?? titleRow(partial.titleId);
  return {
    ...partial,
    kind: meta.kind,
    version,
    needsVersion: meta.kind === "update" && version === null,
    title: display?.name ? { id: display.id, name: pretty(display.name), iconUrl: display.iconUrl } : null,
    suggestedName: buildFileName(partial.titleId, version, ext, display?.name ?? undefined),
  };
}

/** Identification from the file name alone, optionally helped by header info read elsewhere (e.g. the browser). */
export function identifyName(fileName: string, header?: HeaderInfo | null): Identification {
  const fromName = parseFileName(fileName);
  if (fromName.titleId) {
    return finish({ source: "name", confidence: "high", titleId: fromName.titleId, version: fromName.version, candidates: [] }, fileName);
  }
  const q = queryFromFileName(fileName);
  const candidates = searchTitles(q.query, q.hint);

  if (header?.titleId) {
    return finish(
      { source: header.source ?? "ticket", confidence: "high", titleId: header.titleId, version: header.version ?? q.version, candidates },
      fileName,
    );
  }

  const [top, second] = candidates;
  if (!top || top.score < 0.35) {
    return finish({ source: "none", confidence: "low", titleId: null, version: null, candidates }, fileName);
  }
  const gap = top.score - (second?.score ?? 0);
  const confidence = top.score >= 0.82 && gap >= 0.08 ? "high" : top.score >= 0.55 ? "medium" : "low";
  let titleId = top.titleId;
  // The name says "update" but matched the game: point at the update ID.
  if (q.hint === "update" && top.kind === "base") titleId = `${top.titleId.slice(0, 13)}800`;
  return finish({ source: "fuzzy", confidence, titleId, version: q.version, candidates }, fileName);
}

export async function identifyStoredFile(driver: Driver, file: { remote_id: string; name: string; size: number }) {
  const ext = extname(file.name).toLowerCase();
  let header: HeaderInfo | null = null;
  if (ext === ".nsp" || ext === ".nsz") {
    header = await readHeader(driver, file.remote_id, file.size).catch(() => null);
  }
  return identifyName(file.name, header);
}
