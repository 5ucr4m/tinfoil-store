import { Hono } from "hono";
import { extname } from "node:path";
import { z } from "zod";
import { newId } from "../crypto";
import { db } from "../db";
import { driverFor, getIntegration } from "../drivers";
import { errorMessage, fail, failIssue, failWith } from "../http";
import { AppError, localeOf } from "../i18n";
import {
  buildFileName,
  identifyName,
  identifyStoredFile,
  queryFromFileName,
  searchTitles,
  type Identification,
} from "../identify";
import type { FileRow } from "../library";
import { parseFileName } from "../titles";

const CONCURRENCY = 3;

function pendingFiles() {
  return db
    .prepare(
      `SELECT f.*, i.name AS integration_name, i.type AS integration_type, id.data AS identification
       FROM files f
       JOIN integrations i ON i.id = f.integration_id
       LEFT JOIN identifications id ON id.file_id = f.id
       WHERE f.title_id IS NULL
       ORDER BY f.name`,
    )
    .all() as (FileRow & { integration_name: string; integration_type: string; identification: string | null })[];
}

const serialize = (f: ReturnType<typeof pendingFiles>[number]) => ({
  id: f.id,
  name: f.name,
  size: f.size,
  integrationName: f.integration_name,
  integrationType: f.integration_type,
  identification: f.identification ? (JSON.parse(f.identification) as Identification) : null,
});

const saveResult = db.prepare(
  `INSERT INTO identifications (file_id, data, created_at) VALUES (?, ?, ?)
   ON CONFLICT(file_id) DO UPDATE SET data = excluded.data, created_at = excluded.created_at`,
);

/** Renames one library file on its provider and updates the row. Returns the new name. */
async function renameFile(fileId: string, newName: string) {
  const file = db.prepare("SELECT * FROM files WHERE id = ?").get(fileId) as FileRow | undefined;
  if (!file) throw new AppError("errors.fileNotFound", undefined, 404);
  const integration = getIntegration(file.integration_id);
  if (!integration) throw new AppError("errors.fileDestinationRemoved");
  if (file.name === newName) return { file, oldName: file.name };

  const remoteId = await driverFor(integration).rename(file.remote_id, newName, file.size);
  // Disk renames may add " (1)" on collision: keep whatever name actually landed.
  const finalName = integration.type === "gdrive" ? newName : (remoteId.split("/").pop() ?? newName);
  const meta = parseFileName(finalName);
  db.prepare(
    `UPDATE files SET remote_id = ?, name = ?, title_id = ?, base_id = ?, version = ?, kind = ? WHERE id = ?`,
  ).run(remoteId, finalName, meta.titleId, meta.baseId, meta.version, meta.kind, fileId);
  return { file: { ...file, name: finalName }, oldName: file.name };
}

const applySchema = z.object({
  items: z
    .array(
      z.object({
        fileId: z.string(),
        titleId: z.string().regex(/^[0-9A-Fa-f]{16}$/, "errors.titleIdInvalid"),
        version: z.number().int().nonnegative().nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const identifyRoutes = new Hono()
  .get("/pending", (c) => c.json({ files: pendingFiles().map(serialize) }))
  /** Runs both layers over pending files (or the given ones) and stores the results. */
  .post("/run", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { fileIds?: string[] };
    const targets = pendingFiles().filter((f) => !body.fileIds || body.fileIds.includes(f.id));
    const queue = [...targets];
    const worker = async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        const integration = getIntegration(f.integration_id);
        let result: Identification;
        try {
          result = integration ? await identifyStoredFile(driverFor(integration), f) : identifyName(f.name);
        } catch {
          result = identifyName(f.name);
        }
        saveResult.run(f.id, JSON.stringify(result), Date.now());
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    return c.json({ files: pendingFiles().map(serialize) });
  })
  /** For uploads: the browser reads the header itself and sends what it found. */
  .post("/preview", async (c) => {
    const body = (await c.req.json()) as {
      name?: string;
      header?: { titleId: string | null; version: number | null; source: "cnmt" | "ticket" | null };
    };
    if (!body.name) return fail(c, "errors.fileNameRequired");
    return c.json(identifyName(body.name, body.header));
  })
  .get("/search", (c) => {
    const q = c.req.query("q") ?? "";
    const hint = queryFromFileName(q).hint;
    return c.json({ candidates: searchTitles(q, hint, 10) });
  })
  /** Name a title ID + version would get, for the manual picker. */
  .get("/name", (c) => {
    const titleId = (c.req.query("titleId") ?? "").toUpperCase();
    if (!/^[0-9A-F]{16}$/.test(titleId)) return fail(c, "errors.titleIdInvalid");
    const version = c.req.query("version");
    const ext = c.req.query("ext") ?? ".nsp";
    return c.json({ name: buildFileName(titleId, version ? Number(version) : null, ext) });
  })
  .post("/apply", async (c) => {
    const parsed = applySchema.safeParse(await c.req.json());
    if (!parsed.success) return failIssue(c, parsed.error.issues);
    const locale = localeOf(c);
    const results = [];
    for (const item of parsed.data.items) {
      try {
        const file = db.prepare("SELECT name FROM files WHERE id = ?").get(item.fileId) as { name: string } | undefined;
        if (!file) throw new AppError("errors.fileNotFound");
        const kind = parseFileName(`[${item.titleId}]`).kind;
        if (kind === "update" && item.version == null) throw new AppError("errors.updateVersionRequired");
        const target = buildFileName(item.titleId.toUpperCase(), item.version ?? null, extname(file.name));
        const { file: renamed, oldName } = await renameFile(item.fileId, target);
        const renameId = newId();
        db.prepare("INSERT INTO renames (id, file_id, old_name, new_name, created_at) VALUES (?, ?, ?, ?, ?)").run(
          renameId,
          item.fileId,
          oldName,
          renamed.name,
          Date.now(),
        );
        db.prepare("DELETE FROM identifications WHERE file_id = ?").run(item.fileId);
        results.push({ fileId: item.fileId, ok: true, oldName, newName: renamed.name, renameId });
      } catch (err) {
        results.push({ fileId: item.fileId, ok: false, error: errorMessage(err, locale) });
      }
    }
    return c.json({ results });
  })
  .post("/undo/:renameId", async (c) => {
    const rename = db.prepare("SELECT * FROM renames WHERE id = ? AND undone = 0").get(c.req.param("renameId")) as
      | { id: string; file_id: string; old_name: string }
      | undefined;
    if (!rename) return fail(c, "errors.nothingToUndo", 404);
    try {
      const { file } = await renameFile(rename.file_id, rename.old_name);
      db.prepare("UPDATE renames SET undone = 1 WHERE id = ?").run(rename.id);
      return c.json({ ok: true, name: file.name });
    } catch (err) {
      return failWith(c, err, 502);
    }
  })
  .get("/history", (c) =>
    c.json({
      renames: db
        .prepare(
          `SELECT r.id, r.file_id AS fileId, r.old_name AS oldName, r.new_name AS newName, r.undone, r.created_at AS createdAt
           FROM renames r ORDER BY r.created_at DESC LIMIT 50`,
        )
        .all(),
    }),
  );
