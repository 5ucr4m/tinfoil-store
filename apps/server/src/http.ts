import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { storeSettings } from "./db";
import { env } from "./env";
import { AppError, DEFAULT_LOCALE, localeOf, tr, trMaybe, type Locale, type MessageKey, type Params } from "./i18n";

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

/** Error text for a response. AppErrors are translated; provider errors pass through as is. */
export const errorMessage = (err: unknown, locale: Locale = DEFAULT_LOCALE) =>
  err instanceof AppError ? tr(locale, err.key, err.params) : err instanceof Error ? err.message : String(err);

/** JSON error response in the request's language. */
export const fail = (c: Context, key: MessageKey, status: ContentfulStatusCode = 400, params?: Params) =>
  c.json({ error: tr(localeOf(c), key, params) }, status);

/** Error response for a caught error: AppErrors in the request's language, others as is. */
export const failWith = (c: Context, err: unknown, status: ContentfulStatusCode = 500) =>
  c.json({ error: errorMessage(err, localeOf(c)) }, err instanceof AppError && err.status ? (err.status as ContentfulStatusCode) : status);

/** First zod issue, translated when its message is a message key. */
export const failIssue = (c: Context, issues: { message: string }[]) =>
  c.json({ error: trMaybe(localeOf(c), issues[0]?.message ?? "errors.invalidData") }, 400);
