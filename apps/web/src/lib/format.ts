import { getLocale, translate } from "../i18n";

const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function bytes(n: number, digits = 1) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), UNITS.length - 1);
  const value = n / 1024 ** i;
  return `${value.toLocaleString(getLocale(), { maximumFractionDigits: i === 0 ? 0 : digits })} ${UNITS[i]}`;
}

export function duration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}min ${Math.round(seconds % 60)}s`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

export function ago(ts: number | null | undefined) {
  if (!ts) return translate("common.time.never");
  const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: "auto" });
  const diff = (ts - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

/** "Game Name [0100...][v0].nsp" -> "Game Name" */
export function cleanName(name: string) {
  return name
    .replace(/\.(nsp|nsz|xci|xcz)$/i, "")
    .replace(/\[[^\]]*\]|\([^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Titledb names carry trademark symbols and edition suffixes that crowd the label. */
export function prettyTitle(name: string) {
  return name
    .replace(/[™®©]/g, "")
    .replace(/\s*[-–—:]\s*Nintendo Switch\s*2 Edition$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function versionLabel(v: number | null) {
  if (v == null) return null;
  // Switch versions step by 65536 per patch.
  return v === 0 ? "v0" : translate("common.version.patch", { version: v, number: Math.round(v / 65536) });
}

const KIND_RE = /\[([0-9a-fA-F]{16})\]/;

export function parseTitle(name: string) {
  const titleId = name.match(KIND_RE)?.[1]?.toUpperCase() ?? null;
  const version = name.match(/\[v(\d+)\]/i)?.[1];
  let kind: "base" | "update" | "dlc" | "unknown" = "unknown";
  let baseId: string | null = null;
  if (titleId) {
    const n = BigInt(`0x${titleId}`);
    const low = n & 0xfffn;
    const masked = n & ~0xfffn;
    const hex = (x: bigint) => x.toString(16).toUpperCase().padStart(16, "0");
    if (low === 0n) [kind, baseId] = ["base", titleId];
    else if (low === 0x800n) [kind, baseId] = ["update", hex(masked)];
    else [kind, baseId] = ["dlc", hex(masked - 0x1000n)];
  }
  return { titleId, baseId, kind, version: version ? Number(version) : null };
}

export const kindLabel = (kind: "base" | "update" | "dlc" | "unknown") => translate(`common.kind.${kind}`);

/** eShop genre from titledb, in the current language (unknown genres pass through). */
export const genreLabel = (genre: string) => {
  const key = `common.genres.${genre}` as const;
  const label = translate(key as Parameters<typeof translate>[0]);
  return label === key ? genre : label;
};
