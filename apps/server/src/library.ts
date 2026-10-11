import { newId } from "./crypto";
import { db } from "./db";
import { driverFor, getIntegration } from "./drivers";
import type { AccountInfo, RemoteFile } from "./drivers/types";
import { parseFileName } from "./titles";

export interface FileRow {
  id: string;
  integration_id: string;
  remote_id: string;
  name: string;
  size: number;
  title_id: string | null;
  base_id: string | null;
  version: number | null;
  kind: string;
  created_at: number;
}

const upsertStmt = db.prepare(
  `INSERT INTO files (id, integration_id, remote_id, name, size, title_id, base_id, version, kind, created_at)
   VALUES (@id, @integration_id, @remote_id, @name, @size, @title_id, @base_id, @version, @kind, @created_at)
   ON CONFLICT(integration_id, remote_id) DO UPDATE SET
     name = excluded.name, size = excluded.size, title_id = excluded.title_id,
     base_id = excluded.base_id, version = excluded.version, kind = excluded.kind`,
);

export function upsertFile(integrationId: string, remote: RemoteFile): FileRow {
  const meta = parseFileName(remote.name);
  upsertStmt.run({
    id: newId(),
    integration_id: integrationId,
    remote_id: remote.remoteId,
    name: remote.name,
    size: remote.size,
    title_id: meta.titleId,
    base_id: meta.baseId,
    version: meta.version,
    kind: meta.kind,
    created_at: Date.now(),
  });
  return db
    .prepare("SELECT * FROM files WHERE integration_id = ? AND remote_id = ?")
    .get(integrationId, remote.remoteId) as FileRow;
}

export interface IntegrationStatus {
  message?: string;
  account?: AccountInfo;
}

export function setStatus(id: string, status: "ok" | "error" | "pending" | "syncing", detail: IntegrationStatus) {
  db.prepare("UPDATE integrations SET status = ?, status_detail = ? WHERE id = ?").run(
    status,
    JSON.stringify(detail),
    id,
  );
}

const syncing = new Set<string>();

/** Mirrors the provider listing into the files table. */
export async function syncIntegration(id: string) {
  if (syncing.has(id)) return;
  const row = getIntegration(id);
  if (!row) return;
  syncing.add(id);
  const previous = row.status_detail ? (JSON.parse(row.status_detail) as IntegrationStatus) : {};
  setStatus(id, "syncing", previous);
  try {
    const driver = driverFor(row);
    const account = await driver.test().catch(() => previous.account);
    const remote = await driver.list();
    const seen = new Set(remote.map((r) => r.remoteId));
    db.transaction(() => {
      for (const file of remote) upsertFile(id, file);
      const existing = db
        .prepare("SELECT id, remote_id FROM files WHERE integration_id = ?")
        .all(id) as { id: string; remote_id: string }[];
      const del = db.prepare("DELETE FROM files WHERE id = ?");
      for (const f of existing) if (!seen.has(f.remote_id)) del.run(f.id);
    })();
    db.prepare("UPDATE integrations SET last_sync_at = ? WHERE id = ?").run(Date.now(), id);
    setStatus(id, "ok", { account });
  } catch (err) {
    setStatus(id, "error", {
      ...previous,
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    syncing.delete(id);
  }
}

export function syncAll() {
  const rows = db.prepare("SELECT id FROM integrations WHERE status != 'pending'").all() as { id: string }[];
  return Promise.all(rows.map((r) => syncIntegration(r.id)));
}
