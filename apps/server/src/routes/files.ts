import { Hono } from "hono";
import { db } from "../db";
import { driverFor, getIntegration } from "../drivers";
import { errorMessage } from "../http";
import { lookupTitles, refreshTitleDb, titleDbStatus } from "../titles";
import { serveFile } from "./store";
import { listTransfers, startMove } from "../transfer";
import { errorMessage as message } from "../http";

export const fileRoutes = new Hono()
  .get("/", (c) => {
    const files = db
      .prepare(
        `SELECT f.id, f.integration_id AS integrationId, f.name, f.size, f.title_id AS titleId,
                f.base_id AS baseId, f.version, f.kind, f.created_at AS createdAt,
                i.name AS integrationName, i.type AS integrationType,
                own.name AS titleName,
                base.name AS baseName, base.publisher, base.icon_url AS iconUrl, base.banner_url AS bannerUrl,
                base.release_date AS releaseDate, base.categories AS categories
         FROM files f
         JOIN integrations i ON i.id = f.integration_id
         LEFT JOIN titles own ON own.id = f.title_id
         LEFT JOIN titles base ON base.id = f.base_id
         ORDER BY f.created_at DESC`,
      )
      .all() as { categories: string | null }[];
    return c.json({
      files: files.map((f) => ({ ...f, categories: f.categories ? (JSON.parse(f.categories) as string[]) : [] })),
    });
  })
  .get("/stats", (c) => {
    const totals = db
      .prepare(
        `SELECT COUNT(*) AS files, COALESCE(SUM(size), 0) AS bytes,
                COUNT(DISTINCT COALESCE(base_id, id)) AS titles FROM files`,
      )
      .get();
    return c.json(totals);
  })
  .on(["GET", "HEAD"], "/:id/download", serveFile)
  .get("/transfers", (c) => c.json({ transfers: listTransfers() }))
  .post("/:id/move", async (c) => {
    const { integrationId, mode } = (await c.req.json()) as { integrationId?: string; mode?: "move" | "copy" };
    if (!integrationId) return c.json({ error: "Escolha o destino." }, 400);
    try {
      return c.json({ transfer: startMove(c.req.param("id"), integrationId, mode === "copy" ? "copy" : "move") });
    } catch (err) {
      return c.json({ error: message(err) }, 400);
    }
  })
  .delete("/:id", async (c) => {
    const file = db.prepare("SELECT * FROM files WHERE id = ?").get(c.req.param("id")) as
      | { id: string; integration_id: string; remote_id: string }
      | undefined;
    if (!file) return c.json({ error: "Arquivo não encontrado." }, 404);
    if (c.req.query("remote") === "1") {
      const row = getIntegration(file.integration_id);
      try {
        if (row) await driverFor(row).remove(file.remote_id);
      } catch (err) {
        return c.json({ error: `Não foi possível apagar no provider: ${errorMessage(err)}` }, 502);
      }
    }
    db.prepare("DELETE FROM files WHERE id = ?").run(file.id);
    return c.json({ ok: true });
  });

export const titleRoutes = new Hono()
  .get("/", (c) => {
    const ids = (c.req.query("ids") ?? "").split(",").filter((id) => /^[0-9A-Fa-f]{16}$/.test(id));
    return c.json({ titles: lookupTitles(ids.slice(0, 200)) });
  })
  .get("/status", (c) => c.json(titleDbStatus()))
  .get("/:id/details", (c) => {
    const row = db
      .prepare(
        `SELECT name, description, categories, release_date AS releaseDate, screenshots, developer, players
         FROM titles WHERE id = ?`,
      )
      .get(c.req.param("id").toUpperCase()) as
      | {
          name: string | null;
          description: string | null;
          categories: string | null;
          releaseDate: string | null;
          screenshots: string | null;
          developer: string | null;
          players: number | null;
        }
      | undefined;
    return c.json({
      name: row?.name ?? null,
      description: row?.description ?? null,
      categories: row?.categories ? (JSON.parse(row.categories) as string[]) : [],
      screenshots: row?.screenshots ? (JSON.parse(row.screenshots) as string[]) : [],
      releaseDate: row?.releaseDate ?? null,
      developer: row?.developer ?? null,
      players: row?.players ?? null,
    });
  })
  .post("/refresh", (c) => {
    void refreshTitleDb();
    return c.json({ ...titleDbStatus(), state: "running" });
  });
