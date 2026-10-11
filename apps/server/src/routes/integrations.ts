import { Hono } from "hono";
import { z } from "zod";
import { decrypt, encrypt, newId } from "../crypto";
import { db } from "../db";
import { driverFor, forgetDriver, getIntegration, type IntegrationRow } from "../drivers";
import { GDriveDriver, gdriveAuthUrl, gdriveExchangeCode, type GDriveConfig } from "../drivers/gdrive";
import type { IntegrationType } from "../drivers/types";
import { baseUrl, errorMessage, fail, failIssue } from "../http";
import { localeOf, readStored, storeError, tr, type Locale } from "../i18n";
import { setStatus, syncIntegration, type IntegrationStatus } from "../library";

// Validation messages are message keys, translated when the response is built.
const localSchema = z.object({ path: z.string().min(1, "errors.folderRequired") });

const s3Schema = z.object({
  endpoint: z.string().optional().default(""),
  publicEndpoint: z.string().optional().default(""),
  region: z.string().optional().default("auto"),
  bucket: z.string().min(1, "errors.bucketRequired"),
  accessKeyId: z.string().min(1, "errors.accessKeyRequired"),
  secretAccessKey: z.string().optional().default(""),
  prefix: z.string().optional().default(""),
  forcePathStyle: z.boolean().optional().default(false),
  mode: z.enum(["proxy", "redirect"]).default("redirect"),
});

const gdriveSchema = z.object({
  clientId: z.string().min(1, "errors.clientIdRequired"),
  clientSecret: z.string().optional().default(""),
  folderName: z.string().optional().default("Tinfoil"),
});

const schemas = { local: localSchema, s3: s3Schema, gdrive: gdriveSchema } as const;

/** Fields never sent back to the browser. Blank values on edit keep the stored secret. */
const SECRET_FIELDS = ["secretAccessKey", "clientSecret", "refreshToken"];

function publicConfig(row: IntegrationRow) {
  const config = decrypt<Record<string, unknown>>(row.config);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (SECRET_FIELDS.includes(key)) out[`has_${key}`] = Boolean(value);
    else out[key] = value;
  }
  return out;
}

function serialize(row: IntegrationRow, locale: Locale) {
  const stats = db
    .prepare("SELECT COUNT(*) AS count, COALESCE(SUM(size), 0) AS bytes FROM files WHERE integration_id = ?")
    .get(row.id) as { count: number; bytes: number };
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    status: row.status,
    detail: presentStatus(row.status_detail ? (JSON.parse(row.status_detail) as IntegrationStatus) : {}, locale),
    lastSyncAt: row.last_sync_at,
    createdAt: row.created_at,
    config: publicConfig(row),
    fileCount: stats.count,
    totalBytes: stats.bytes,
  };
}

/** Status as sent to the panel: the stored error becomes text in the request's language. */
function presentStatus({ messageKey, params, ...detail }: IntegrationStatus, locale: Locale) {
  return { ...detail, message: readStored(locale, { message: detail.message, messageKey, params }) };
}

const redirectUri = (c: Parameters<typeof baseUrl>[0]) => `${baseUrl(c)}/api/integrations/gdrive/callback`;

async function verifyAndSync(id: string) {
  const row = getIntegration(id)!;
  try {
    const account = await driverFor(row).test();
    setStatus(id, "ok", { account });
    void syncIntegration(id);
  } catch (err) {
    setStatus(id, "error", storeError(err));
  }
}

export const integrationRoutes = new Hono()
  .get("/", (c) => {
    const rows = db.prepare("SELECT * FROM integrations ORDER BY created_at").all() as IntegrationRow[];
    const locale = localeOf(c);
    return c.json({ integrations: rows.map((r) => serialize(r, locale)), redirectUri: redirectUri(c) });
  })
  .post("/", async (c) => {
    const body = (await c.req.json()) as { type: IntegrationType; name?: string; config: unknown };
    const schema = schemas[body.type];
    if (!schema) return fail(c, "errors.integrationTypeInvalid");
    const parsed = schema.safeParse(body.config);
    if (!parsed.success) return failIssue(c, parsed.error.issues);
    const config = parsed.data as Record<string, unknown>;
    if (body.type === "s3" && !config.secretAccessKey) return fail(c, "errors.secretKeyRequired");
    if (body.type === "gdrive" && !config.clientSecret) return fail(c, "errors.clientSecretRequired");

    const id = newId();
    const locale = localeOf(c);
    // Name chosen in the panel's language when the user leaves it blank.
    const fallbackName = tr(locale, `names.${body.type}`);
    db.prepare(
      "INSERT INTO integrations (id, type, name, config, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
    ).run(id, body.type, body.name?.trim() || fallbackName, encrypt(config), Date.now());

    if (body.type === "gdrive") {
      return c.json({
        integration: serialize(getIntegration(id)!, locale),
        authUrl: gdriveAuthUrl(config as unknown as GDriveConfig, redirectUri(c), id),
      });
    }
    await verifyAndSync(id);
    return c.json({ integration: serialize(getIntegration(id)!, locale) });
  })
  .patch("/:id", async (c) => {
    const row = getIntegration(c.req.param("id"));
    if (!row) return fail(c, "errors.integrationNotFound", 404);
    const body = (await c.req.json()) as { name?: string; config?: Record<string, unknown> };
    const current = decrypt<Record<string, unknown>>(row.config);
    if (body.config) {
      const parsed = schemas[row.type].safeParse({ ...current, ...body.config });
      if (!parsed.success) return failIssue(c, parsed.error.issues);
      const next: Record<string, unknown> = { ...current, ...parsed.data };
      for (const field of SECRET_FIELDS) if (!body.config[field] && current[field]) next[field] = current[field];
      // Changing the Drive folder name points the integration at a different folder.
      if (row.type === "gdrive" && next.folderName !== current.folderName) delete next.folderId;
      db.prepare("UPDATE integrations SET config = ? WHERE id = ?").run(encrypt(next), row.id);
      forgetDriver(row.id);
    }
    if (body.name?.trim()) db.prepare("UPDATE integrations SET name = ? WHERE id = ?").run(body.name.trim(), row.id);
    if (body.config && row.status !== "pending") await verifyAndSync(row.id);
    return c.json({ integration: serialize(getIntegration(row.id)!, localeOf(c)) });
  })
  .delete("/:id", (c) => {
    const id = c.req.param("id");
    db.prepare("DELETE FROM integrations WHERE id = ?").run(id);
    forgetDriver(id);
    return c.json({ ok: true });
  })
  .post("/:id/test", async (c) => {
    const row = getIntegration(c.req.param("id"));
    if (!row) return fail(c, "errors.integrationNotFound", 404);
    try {
      const account = await driverFor(row).test();
      setStatus(row.id, "ok", { account });
    } catch (err) {
      setStatus(row.id, "error", storeError(err));
    }
    return c.json({ integration: serialize(getIntegration(row.id)!, localeOf(c)) });
  })
  .post("/:id/sync", async (c) => {
    const row = getIntegration(c.req.param("id"));
    if (!row) return fail(c, "errors.integrationNotFound", 404);
    await syncIntegration(row.id);
    return c.json({ integration: serialize(getIntegration(row.id)!, localeOf(c)) });
  })
  .get("/:id/connect", (c) => {
    const row = getIntegration(c.req.param("id"));
    if (!row || row.type !== "gdrive") return fail(c, "errors.integrationNotFound", 404);
    return c.json({ authUrl: gdriveAuthUrl(decrypt<GDriveConfig>(row.config), redirectUri(c), row.id) });
  });

/** OAuth callback: Google redirects the browser here after consent. */
export const gdriveCallback = new Hono().get("/", async (c) => {
  const id = c.req.query("state") ?? "";
  // A browser redirect carries no panel header: the language comes from Accept-Language.
  const locale = localeOf(c);
  const back = (params: Record<string, string>) => c.redirect(`/integrations?${new URLSearchParams(params)}`);
  const row = getIntegration(id);
  if (!row) return back({ error: tr(locale, "errors.integrationNotFound") });
  const oauthError = c.req.query("error");
  if (oauthError) return back({ error: tr(locale, "errors.googleDenied", { reason: oauthError }), id });

  try {
    const config = decrypt<GDriveConfig>(row.config);
    config.refreshToken = await gdriveExchangeCode(config, c.req.query("code") ?? "", redirectUri(c));
    const driver = new GDriveDriver(row.id, config);
    const account = await driver.test();
    Object.assign(config, await driver.ensureFolder(config.folderName || "Tinfoil"), {
      email: account.label,
    });
    db.prepare("UPDATE integrations SET config = ? WHERE id = ?").run(encrypt(config), row.id);
    forgetDriver(row.id);
    setStatus(row.id, "ok", { account });
    void syncIntegration(row.id);
    return back({ connected: row.id });
  } catch (err) {
    setStatus(row.id, "error", storeError(err));
    return back({ error: errorMessage(err, locale), id: row.id });
  }
});
