import type { Context } from "hono";
import { storeSettings } from "./db";
import { env } from "./env";

/** Base URL as seen by clients: settings > env > proxy headers > Host. */
export function baseUrl(c: Context) {
  const configured = storeSettings().publicUrl || env.publicUrl;
  if (configured) return configured.replace(/\/$/, "");
  const proto = c.req.header("x-forwarded-proto")?.split(",")[0] ?? new URL(c.req.url).protocol.replace(":", "");
  const host = c.req.header("x-forwarded-host") ?? c.req.header("host") ?? new URL(c.req.url).host;
  return `${proto}://${host}`;
}

/** Parses a single-range "bytes=" header. Returns null for absent, "invalid" for unsatisfiable. */
export function parseRange(header: string | undefined, size: number) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  let start: number;
  let end: number;
  if (rawStart === "") {
    const suffix = Number(rawEnd);
    if (!suffix) return "invalid" as const;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }
  if (start > end || start >= size) return "invalid" as const;
  return { start, end };
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));
