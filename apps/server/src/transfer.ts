import { newId } from "./crypto";
import { db } from "./db";
import { driverFor, getIntegration } from "./drivers";
import { LocalDriver } from "./drivers/local";
import { S3Driver } from "./drivers/s3";
import type { UploadPlan } from "./drivers/types";
import { errorMessage } from "./http";
import { upsertFile, type FileRow } from "./library";

/**
 * Moves or replicates a file between providers on the server: streams it out of the source and
 * feeds the destination's own upload flow (chunks for disk, resumable session for
 * Drive, multipart for S3). The source is deleted only after the copy checks out.
 */

export interface Transfer {
  id: string;
  fileId: string;
  name: string;
  size: number;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  /** move deletes the source after copying; copy keeps it (replica/backup). */
  mode: "move" | "copy";
  state: "queued" | "copying" | "finishing" | "done" | "error";
  copied: number;
  error?: string;
  startedAt: number;
  finishedAt?: number;
  newFileId?: string;
}

const transfers = new Map<string, Transfer>();
const queue: string[] = [];
let running = 0;
const CONCURRENCY = 2;

export const listTransfers = () =>
  [...transfers.values()].sort((a, b) => b.startedAt - a.startedAt).slice(0, 50);

export function startMove(fileId: string, toId: string, mode: "move" | "copy" = "move") {
  const file = db.prepare("SELECT * FROM files WHERE id = ?").get(fileId) as FileRow | undefined;
  if (!file) throw new Error("Arquivo não encontrado.");
  const from = getIntegration(file.integration_id);
  const to = getIntegration(toId);
  if (!from || !to) throw new Error("Destino não encontrado.");
  if (from.id === to.id) throw new Error("O arquivo já está nesse destino.");
  if (to.status === "pending") throw new Error("Termine de conectar esse destino antes de mover.");
  const replica = db
    .prepare("SELECT 1 FROM files WHERE integration_id = ? AND name = ? AND size = ?")
    .get(to.id, file.name, file.size);
  if (replica) throw new Error(`Já existe uma cópia desse arquivo em ${to.name}.`);
  const active = [...transfers.values()].find((t) => t.fileId === fileId && !["done", "error"].includes(t.state));
  if (active) return active;

  const t: Transfer = {
    id: newId(),
    fileId,
    name: file.name,
    size: file.size,
    fromId: from.id,
    fromName: from.name,
    toId: to.id,
    toName: to.name,
    mode,
    state: "queued",
    copied: 0,
    startedAt: Date.now(),
  };
  transfers.set(t.id, t);
  queue.push(t.id);
  pump();
  return t;
}

function pump() {
  while (running < CONCURRENCY && queue.length) {
    const t = transfers.get(queue.shift()!)!;
    running++;
    void run(t).finally(() => {
      running--;
      pump();
    });
  }
}

/** Re-chunks a byte stream into fixed-size pieces (the last one may be shorter). */
async function* chunks(stream: ReadableStream<Uint8Array>, size: number) {
  const reader = stream.getReader();
  let buf = new Uint8Array(size);
  let fill = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    let pos = 0;
    while (pos < value.length) {
      const take = Math.min(size - fill, value.length - pos);
      buf.set(value.subarray(pos, pos + take), fill);
      fill += take;
      pos += take;
      if (fill === size) {
        yield buf;
        buf = new Uint8Array(size);
        fill = 0;
      }
    }
  }
  if (fill) yield buf.subarray(0, fill);
}

const chunkSizeOf = (plan: UploadPlan) =>
  plan.kind === "s3" ? plan.partSize : plan.chunkSize;

async function run(t: Transfer) {
  t.state = "copying";
  const file = db.prepare("SELECT * FROM files WHERE id = ?").get(t.fileId) as FileRow | undefined;
  const from = getIntegration(t.fromId);
  const to = getIntegration(t.toId);
  if (!file || !from || !to) {
    t.state = "error";
    t.error = "Arquivo ou destino removido durante a cópia.";
    return;
  }
  const source = driverFor(from);
  const dest = driverFor(to);
  const uploadId = newId();
  let data: Record<string, unknown> = {};

  try {
    const init = await dest.initUpload({ uploadId, name: file.name, size: file.size }, "");
    data = init.data;
    const plan = init.plan;
    const payload: Record<string, unknown> = {};
    const parts: { partNumber: number; etag: string }[] = [];
    let offset = 0;
    let n = 0;

    for await (const chunk of chunks(await source.read(file.remote_id, null), chunkSizeOf(plan))) {
      n++;
      if (dest instanceof LocalDriver) {
        const res = await dest.writeChunk(uploadId, offset, new Blob([chunk]).stream());
        if (!res.ok) throw new Error("Escrita fora de ordem no disco.");
      } else if (dest instanceof S3Driver) {
        parts.push({ partNumber: n, etag: await dest.putPart(data, n, chunk) });
      } else if (plan.kind === "gdrive") {
        const end = offset + chunk.length - 1;
        const res = await fetch(plan.sessionUrl, {
          method: "PUT",
          headers: { "Content-Range": `bytes ${offset}-${end}/${file.size}` },
          body: chunk,
        });
        if (res.status === 200 || res.status === 201) payload.remoteId = ((await res.json()) as { id: string }).id;
        else if (res.status !== 308) throw new Error(`Google Drive respondeu ${res.status}`);
      }
      offset += chunk.length;
      t.copied = offset;
    }
    if (offset !== file.size) throw new Error(`Cópia incompleta: ${offset} de ${file.size} bytes.`);

    t.state = "finishing";
    if (parts.length) payload.parts = parts;
    const remote = await dest.completeUpload({ uploadId, name: file.name, size: file.size, data }, payload);
    if (remote.size !== file.size) throw new Error("O tamanho no destino não confere. A origem foi mantida.");

    // New row first, then drop the old one: the library never loses the title.
    const moved = upsertFile(to.id, remote);
    if (t.mode === "move") {
      await source.remove(file.remote_id);
      db.prepare("DELETE FROM files WHERE id = ?").run(file.id);
    }
    t.newFileId = moved.id;
    t.state = "done";
  } catch (err) {
    await dest.abortUpload({ uploadId, name: file.name, size: file.size, data }).catch(() => {});
    t.state = "error";
    t.error = errorMessage(err);
  } finally {
    t.finishedAt = Date.now();
  }
}
