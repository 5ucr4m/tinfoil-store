import { Hono } from "hono";
import { z } from "zod";
import { newId } from "../crypto";
import { db } from "../db";
import { driverFor, getIntegration } from "../drivers";
import { LocalDriver } from "../drivers/local";
import { baseUrl, fail, failWith } from "../http";
import { upsertFile } from "../library";
import { isGameFile } from "../titles";

interface UploadRow {
  id: string;
  integration_id: string;
  name: string;
  size: number;
  state: string;
  data: string | null;
}

const startSchema = z.object({
  integrationId: z.string(),
  name: z.string().min(1),
  size: z.number().int().nonnegative(),
});

function load(id: string) {
  const row = db.prepare("SELECT * FROM uploads WHERE id = ?").get(id) as UploadRow | undefined;
  if (!row) return null;
  const integration = getIntegration(row.integration_id);
  if (!integration) return null;
  return {
    row,
    driver: driverFor(integration),
    ref: { uploadId: row.id, name: row.name, size: row.size, data: JSON.parse(row.data ?? "{}") },
  };
}

export const uploadRoutes = new Hono()
  .post("/", async (c) => {
    const parsed = startSchema.safeParse(await c.req.json());
    if (!parsed.success) return fail(c, "errors.uploadInvalid");
    const { integrationId, name, size } = parsed.data;
    if (!isGameFile(name)) return fail(c, "errors.uploadFileType");
    const integration = getIntegration(integrationId);
    if (!integration) return fail(c, "errors.uploadNoDestination");
    if (integration.status === "pending") return fail(c, "errors.destinationPendingUpload");

    const id = newId();
    try {
      const origin = c.req.header("origin") ?? baseUrl(c);
      const { plan, data } = await driverFor(integration).initUpload({ uploadId: id, name, size }, origin);
      db.prepare(
        "INSERT INTO uploads (id, integration_id, name, size, state, data, created_at) VALUES (?, ?, ?, ?, 'open', ?, ?)",
      ).run(id, integrationId, name, size, JSON.stringify(data), Date.now());
      return c.json({ id, plan });
    } catch (err) {
      return failWith(c, err, 502);
    }
  })
  .put("/:id/chunk", async (c) => {
    const upload = load(c.req.param("id"));
    if (!upload || !(upload.driver instanceof LocalDriver)) return fail(c, "errors.uploadNotFound", 404);
    const body = c.req.raw.body;
    if (!body) return fail(c, "errors.emptyChunk");
    const result = await upload.driver.writeChunk(upload.row.id, Number(c.req.query("offset") ?? 0), body);
    return c.json({ offset: result.offset }, result.ok ? 200 : 409);
  })
  .get("/:id/offset", async (c) => {
    const upload = load(c.req.param("id"));
    if (!upload || !(upload.driver instanceof LocalDriver)) return fail(c, "errors.uploadNotFound", 404);
    return c.json({ offset: await upload.driver.currentOffset(upload.row.id) });
  })
  .post("/:id/complete", async (c) => {
    const upload = load(c.req.param("id"));
    if (!upload) return fail(c, "errors.uploadNotFound", 404);
    try {
      const remote = await upload.driver.completeUpload(upload.ref, await c.req.json().catch(() => ({})));
      const file = upsertFile(upload.row.integration_id, remote);
      db.prepare("DELETE FROM uploads WHERE id = ?").run(upload.row.id);
      return c.json({ file });
    } catch (err) {
      return failWith(c, err, 502);
    }
  })
  .delete("/:id", async (c) => {
    const upload = load(c.req.param("id"));
    if (!upload) return c.json({ ok: true });
    await upload.driver.abortUpload(upload.ref).catch(() => {});
    db.prepare("DELETE FROM uploads WHERE id = ?").run(upload.row.id);
    return c.json({ ok: true });
  });
