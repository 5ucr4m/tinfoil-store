import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Hono, type Context, type MiddlewareHandler } from "hono";
import { secret, verifyPassword } from "../crypto";
import { db, storeSettings } from "../db";
import { driverFor, getIntegration } from "../drivers";
import { baseUrl, errorMessage, fail, parseRange } from "../http";
import { localeOf, tr } from "../i18n";
import { cachedImage, type ImageKind } from "../images";
import type { FileRow } from "../library";
import { parseFileName } from "../titles";

/**
 * The Tinfoil-facing store. Tinfoil authenticates with HTTP Basic and identifies
 * the console through the UID header, which we record for approval.
 */

// scrypt is slow on purpose; Tinfoil sends credentials with every ranged request.
const verified = new Map<string, { userId: string; expiresAt: number }>();
export const forgetStoreCredentials = () => verified.clear();

const unauthorized = (c: Context) =>
  // Tinfoil sends its own Language header, so console errors follow the console's language.
  c.json({ error: tr(localeOf(c), "store.badCredentials") }, 401, {
    "WWW-Authenticate": 'Basic realm="Cartucho", charset="UTF-8"',
  });

// Short, typeable passwords are fine only with throttling: per-IP failure count with growing lockout.
const failures = new Map<string, { count: number; until: number }>();
const clientIp = (c: Context) =>
  c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? c.req.header("x-real-ip") ?? "local";

const basicAuth: MiddlewareHandler = async (c, next) => {
  const hasUsers = db.prepare("SELECT 1 FROM store_users LIMIT 1").get();
  if (!hasUsers) {
    return c.json({ error: tr(localeOf(c), "store.noUsers") });
  }
  const header = c.req.header("authorization") ?? "";
  if (!header.startsWith("Basic ")) return unauthorized(c);

  const cacheKey = createHash("sha256").update(header).digest("hex");
  const cached = verified.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    c.set("storeUserId" as never, cached.userId as never);
    return next();
  }

  const ip = clientIp(c);
  const lock = failures.get(ip);
  if (lock && lock.until > Date.now()) {
    return fail(c, "store.tooManyAttempts", 429, { seconds: Math.ceil((lock.until - Date.now()) / 1000) });
  }

  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const sep = decoded.indexOf(":");
  const username = decoded.slice(0, sep);
  // Generated passwords never contain whitespace; tolerate it when typed from the grouped display.
  const password = decoded.slice(sep + 1).replace(/\s+/g, "");
  const user = db.prepare("SELECT id, password_hash FROM store_users WHERE username = ?").get(username) as
    | { id: string; password_hash: string }
    | undefined;
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    const count = (lock?.count ?? 0) + 1;
    // Five free attempts, then 2s, 4s, 8s… capped at 15 minutes.
    failures.set(ip, { count, until: count >= 5 ? Date.now() + Math.min(2 ** (count - 4), 900) * 1000 : 0 });
    return unauthorized(c);
  }
  failures.delete(ip);

  verified.set(cacheKey, { userId: user.id, expiresAt: Date.now() + 10 * 60_000 });
  c.set("storeUserId" as never, user.id as never);
  db.prepare("UPDATE store_users SET last_used_at = ? WHERE id = ?").run(Date.now(), user.id);
  await next();
};

/** Records the console and enforces approval. Applied to index requests only. */
const consoleGate: MiddlewareHandler = async (c, next) => {
  const uid = c.req.header("uid")?.trim();
  const settings = storeSettings();
  if (uid) {
    const now = Date.now();
    db.prepare(
      `INSERT INTO consoles (uid, version, last_ip, first_seen, last_seen, hits)
       VALUES (?, ?, ?, ?, ?, 1)
       ON CONFLICT(uid) DO UPDATE SET version = excluded.version, last_ip = excluded.last_ip,
         last_seen = excluded.last_seen, hits = hits + 1`,
    ).run(
      uid,
      c.req.header("version") ?? null,
      c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? c.req.header("x-real-ip") ?? null,
      now,
      now,
    );
  }
  if (settings.requireApproval) {
    const allowed = uid
      ? (db.prepare("SELECT allowed FROM consoles WHERE uid = ?").get(uid) as { allowed: number } | undefined)
      : undefined;
    if (!allowed?.allowed) {
      const locale = localeOf(c);
      return c.json({
        error: uid ? tr(locale, "store.consoleNotApprovedUid", { uid: uid.slice(0, 8) }) : tr(locale, "store.consoleNotApproved"),
      });
    }
  }
  await next();
};

/*
 * Tinfoil sends Basic auth for the index but not for the file downloads it lists.
 * Each file URL therefore carries a token signed for the user who fetched the index:
 * "<userId>.<expiry>.<hmac>". It stops working when it expires or the user is deleted.
 */
const TOKEN_DAYS = 30;

function sign(fileId: string, userId: string, exp: number) {
  return createHmac("sha256", secret).update(`${fileId}.${userId}.${exp}`).digest("base64url").slice(0, 32);
}

export function downloadToken(fileId: string, userId: string) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_DAYS * 86_400;
  return `${userId}.${exp}.${sign(fileId, userId, exp)}`;
}

function checkToken(subject: string, token: string) {
  const [userId, expRaw, sig] = token.split(".");
  const exp = Number(expRaw);
  if (!userId || !sig || !exp || exp < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(subject, userId, exp));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  return Boolean(db.prepare("SELECT 1 FROM store_users WHERE id = ?").get(userId));
}

const imageToken = (titleId: string, userId: string) => downloadToken(`img:${titleId}`, userId);

const imageAuth: MiddlewareHandler = async (c, next) => {
  if (!checkToken(`img:${c.req.param("titleId")}`, c.req.param("token") ?? "")) {
    return fail(c, "store.imageLinkInvalid", 401);
  }
  await next();
};

async function serveImage(c: Context) {
  const titleId = (c.req.param("titleId") ?? "").toUpperCase();
  const kind = c.req.param("kind")?.replace(/(-v\d+)?\.\w+$/, "") as ImageKind;
  if (!/^[0-9A-F]{16}$/.test(titleId) || !["icon", "banner", "boxart"].includes(kind)) return c.notFound();
  const image = await cachedImage(titleId, kind).catch(() => null);
  if (!image) return c.notFound();
  return c.body(new Uint8Array(image.body), 200, {
    "Content-Type": image.type,
    "Cache-Control": "public, max-age=604800",
  });
}

const tokenAuth: MiddlewareHandler = async (c, next) => {
  if (!checkToken(c.req.param("id") ?? "", c.req.param("token") ?? "")) {
    return fail(c, "store.downloadLinkInvalid", 401);
  }
  await next();
};

type ReplicaRow = FileRow & { integration_type: string; integration_created: number };

/** Copies of a file across providers share name and size. Oldest destination first. */
function replicasOf(file: FileRow) {
  return db
    .prepare(
      `SELECT f.*, i.type AS integration_type, i.created_at AS integration_created FROM files f
       JOIN integrations i ON i.id = f.integration_id
       WHERE f.name = ? AND f.size = ?
       ORDER BY (f.id = ?) DESC, i.created_at`,
    )
    .all(file.name, file.size, file.id) as ReplicaRow[];
}

function buildIndex(c: Context, direct: boolean) {
  const base = baseUrl(c);
  const userId = c.get("storeUserId" as never) as string;
  const rows = db
    .prepare(
      `SELECT f.*, i.type AS integration_type, i.created_at AS integration_created FROM files f
       JOIN integrations i ON i.id = f.integration_id ORDER BY f.name, i.created_at`,
    )
    .all() as ReplicaRow[];

  // One entry per file even when it is replicated; Tinfoil would show duplicates otherwise.
  const unique = new Map<string, ReplicaRow>();
  for (const f of rows) {
    const key = `${f.name}\u0000${f.size}`;
    const current = unique.get(key);
    // Direct mode prefers the Drive copy so the console can fetch it itself.
    if (!current || (direct && f.integration_type === "gdrive" && current.integration_type !== "gdrive")) unique.set(key, f);
  }

  const index: Record<string, unknown> = {
    files: [...unique.values()].map((f) => {
      // Tinfoil reads the title ID and version from the fragment.
      const fragment = encodeURIComponent(f.name);
      const url =
        direct && f.integration_type === "gdrive"
          ? `gdrive:/${f.remote_id}#${fragment}`
          : `${base}/tinfoil/d/${downloadToken(f.id, userId)}/${f.id}/${fragment}#${fragment}`;
      return { url, size: f.size };
    }),
  };
  index.titledb = titleDbFor([...unique.values()], base, userId, tr(localeOf(c), "store.updateSuffix"));
  const { welcomeMessage } = storeSettings();
  if (welcomeMessage) index.success = welcomeMessage;
  return c.json(index);
}

interface TitleRow {
  id: string;
  name: string | null;
  publisher: string | null;
  icon_url: string | null;
  banner_url: string | null;
  release_date: string | null;
  description: string | null;
  categories: string | null;
  players: number | null;
  developer: string | null;
  raw: string | null;
}

/**
 * Metadata Tinfoil can use without its own database or Nintendo's CDN, in titledb's
 * own shape and keyed by title ID. Images point back at this server.
 */
function titleDbFor(files: FileRow[], base: string, userId: string, updateSuffix: string) {
  const ids = new Set<string>();
  for (const f of files) {
    if (f.title_id) ids.add(f.title_id);
    if (f.base_id) ids.add(f.base_id);
  }
  if (!ids.size) return {};
  const rows = db
    .prepare(`SELECT * FROM titles WHERE id IN (${[...ids].map(() => "?").join(",")})`)
    .all(...ids) as TitleRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  // The version in the name busts Tinfoil's image cache when the format changes.
  const image = (id: string, kind: ImageKind) => `${base}/tinfoil/i/${imageToken(id, userId)}/${id}/${kind}-v3.jpg`;

  const out: Record<string, Record<string, unknown>> = {};
  for (const id of ids) {
    const meta = parseFileName(`[${id}]`);
    const own = byId.get(id);
    // Updates have no titledb entry of their own: describe them with the game's data.
    const row = own?.name ? own : meta.baseId ? byId.get(meta.baseId) : undefined;
    if (!row?.name) continue;
    // Start from the full titledb entry Tinfoil knows, then point images at this server.
    const raw = (row.raw ? JSON.parse(row.raw) : {}) as Record<string, unknown>;
    out[id] = {
      ...raw,
      id,
      name: meta.kind === "update" ? `${row.name} ${updateSuffix}` : row.name,
      publisher: row.publisher ?? raw.publisher,
      description: row.description ?? raw.description,
      iconUrl: row.icon_url ? image(row.id, "icon") : undefined,
      bannerUrl: row.banner_url ? image(row.id, "banner") : undefined,
      frontBoxArt: raw.frontBoxArt ? image(row.id, "boxart") : undefined,
    };
  }
  return out;
}

/**
 * Streams or redirects to a library file. Shared by the store and the panel download.
 * When the file has replicas, a provider that fails is skipped in favour of the next copy.
 */
export async function serveFile(c: Context) {
  const file = db.prepare("SELECT * FROM files WHERE id = ?").get(c.req.param("id")) as FileRow | undefined;
  if (!file) return fail(c, "errors.fileNotFound", 404);

  const range = parseRange(c.req.header("range"), file.size);
  if (range === "invalid") {
    return c.body(null, 416, { "Content-Range": `bytes */${file.size}` });
  }
  const headers: Record<string, string> = {
    "Accept-Ranges": "bytes",
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    "Content-Length": String(range ? range.end - range.start + 1 : file.size),
  };
  if (range) headers["Content-Range"] = `bytes ${range.start}-${range.end}/${file.size}`;
  const status = range ? 206 : 200;

  const errors: string[] = [];
  for (const copy of replicasOf(file)) {
    const integration = getIntegration(copy.integration_id);
    if (!integration) continue;
    try {
      const driver = driverFor(integration);
      const direct = await driver.directUrl(copy.remote_id, copy.name);
      if (direct) return c.redirect(direct, 302);
      if (c.req.method === "HEAD") return c.body(null, status, headers);
      const stream = await driver.read(copy.remote_id, range);
      return new Response(stream, { status, headers });
    } catch (err) {
      errors.push(`${integration.name}: ${errorMessage(err, localeOf(c))}`);
    }
  }
  const locale = localeOf(c);
  return fail(c, "store.readFailed", 502, { detail: errors.join(" | ") || tr(locale, "store.destinationRemoved") });
}

/** One line per store request: enough to debug a console without logging credentials. */
const requestLog: MiddlewareHandler = async (c, next) => {
  const started = Date.now();
  await next();
  const h = (name: string) => c.req.header(name);
  console.log(
    `[store] ${c.req.method} ${new URL(c.req.url).pathname} -> ${c.res.status} ${Date.now() - started}ms` +
      ` host=${h("host")} range=${h("range") ?? "-"} auth=${h("authorization") ? "yes" : "no"}` +
      ` uid=${h("uid")?.slice(0, 8) ?? "-"} ua=${h("user-agent") ?? "-"}`,
  );
};

export const storeRoutes = new Hono()
  .use("*", requestLog)
  .on(["GET", "HEAD"], "/d/:token/:id/:name?", tokenAuth, serveFile)
  .get("/i/:token/:titleId/:kind", imageAuth, serveImage)
  .use("*", async (c, next) => (/\/tinfoil\/[di]\//.test(new URL(c.req.url).pathname) ? next() : basicAuth(c, next)))
  .get("/", consoleGate, (c) => buildIndex(c, false))
  .get("/gdrive", consoleGate, (c) => buildIndex(c, true))
  .on(["GET", "HEAD"], "/f/:id/:name?", serveFile);
