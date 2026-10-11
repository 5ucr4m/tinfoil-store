import { useSyncExternalStore } from "react";
import { getLocale, translate } from "../i18n";
import { api, type IntegrationType, type LibraryFile } from "./api";
import { parseTitle } from "./format";

/**
 * Upload engine. Bytes go from the browser straight to the provider:
 *  - gdrive: resumable session URL opened by the server
 *  - s3: presigned multipart part URLs
 *  - local: chunked PUTs to this server
 * The queue lives at module level so it survives navigation between pages.
 */

export type UploadState =
  | "queued"
  | "starting"
  | "uploading"
  | "paused"
  | "finishing"
  | "done"
  | "error"
  | "canceled";

type Plan =
  | { kind: "local"; chunkSize: number; offset: number }
  | { kind: "gdrive"; sessionUrl: string; chunkSize: number }
  | { kind: "s3"; partSize: number; partUrls: string[] };

export interface UploadItem {
  key: string;
  file: File;
  name: string;
  /** Name on disk before automatic identification renamed it. */
  originalName?: string;
  size: number;
  titleId: string | null;
  baseId: string | null;
  kind: ReturnType<typeof parseTitle>["kind"];
  integrationId: string;
  integrationName: string;
  integrationType: IntegrationType;
  state: UploadState;
  /** Bytes confirmed by the provider plus bytes in flight. */
  sent: number;
  speed: number;
  error?: string;
  retrying?: number;
  addedAt: number;
  finishedAt?: number;
}

interface Internal {
  serverId?: string;
  plan?: Plan;
  committed: number;
  parts: { partNumber: number; etag: string }[];
  xhr?: XMLHttpRequest;
  stop?: "pause" | "cancel";
  lastSample?: { t: number; sent: number };
}

const CONCURRENCY = 2;
const MAX_RETRIES = 5;

let items: UploadItem[] = [];
const internals = new Map<string, Internal>();
const listeners = new Set<() => void>();
const doneListeners = new Set<(file: LibraryFile) => void>();

function emit() {
  items = [...items];
  listeners.forEach((l) => l());
}

function patch(key: string, changes: Partial<UploadItem>) {
  items = items.map((it) => (it.key === key ? { ...it, ...changes } : it));
  listeners.forEach((l) => l());
}

const get = (key: string) => items.find((i) => i.key === key);

export function useUploads() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
  );
}

export function onUploadDone(fn: (file: LibraryFile) => void) {
  doneListeners.add(fn);
  return () => doneListeners.delete(fn);
}

export function enqueue(
  files: { file: File; name?: string }[],
  target: { id: string; name: string; type: IntegrationType },
) {
  for (const { file, name = file.name } of files) {
    const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const meta = parseTitle(name);
    items.push({
      key,
      file,
      name,
      originalName: name !== file.name ? file.name : undefined,
      size: file.size,
      titleId: meta.titleId,
      baseId: meta.baseId,
      kind: meta.kind,
      integrationId: target.id,
      integrationName: target.name,
      integrationType: target.type,
      state: "queued",
      sent: 0,
      speed: 0,
      addedAt: Date.now(),
    });
    internals.set(key, { committed: 0, parts: [] });
  }
  emit();
  pump();
}

export function pause(key: string) {
  const internal = internals.get(key);
  const item = get(key);
  if (!internal || !item) return;
  if (item.state === "queued") return patch(key, { state: "paused" });
  internal.stop = "pause";
  internal.xhr?.abort();
}

export function resume(key: string) {
  const item = get(key);
  if (!item || !["paused", "error"].includes(item.state)) return;
  const internal = internals.get(key)!;
  internal.stop = undefined;
  patch(key, { state: "queued", error: undefined, sent: internal.committed });
  pump();
}

export async function cancel(key: string) {
  const internal = internals.get(key);
  const item = get(key);
  if (!internal || !item) return;
  internal.stop = "cancel";
  internal.xhr?.abort();
  patch(key, { state: "canceled", speed: 0 });
  if (internal.serverId) await api(`/uploads/${internal.serverId}`, { method: "DELETE" }).catch(() => {});
  pump();
}

export function dismiss(key: string) {
  items = items.filter((i) => i.key !== key);
  internals.delete(key);
  emit();
}

export function clearFinished() {
  items = items.filter((i) => !["done", "canceled"].includes(i.state));
  emit();
}

export const isActive = (s: UploadState) => s === "starting" || s === "uploading" || s === "finishing";

function pump() {
  const running = items.filter((i) => isActive(i.state)).length;
  const next = items.filter((i) => i.state === "queued").slice(0, Math.max(0, CONCURRENCY - running));
  for (const item of next) void run(item.key);
}

// Speed sampler: exponential moving average over 600ms windows.
setInterval(() => {
  const now = performance.now();
  let changed = false;
  items = items.map((item) => {
    const internal = internals.get(item.key);
    if (!internal || item.state !== "uploading") return item;
    const last = internal.lastSample;
    internal.lastSample = { t: now, sent: item.sent };
    if (!last) return item;
    const instant = ((item.sent - last.sent) / (now - last.t)) * 1000;
    changed = true;
    return { ...item, speed: item.speed ? item.speed * 0.7 + instant * 0.3 : instant };
  });
  if (changed) listeners.forEach((l) => l());
}, 600);

window.addEventListener("beforeunload", (e) => {
  if (items.some((i) => isActive(i.state) || i.state === "queued")) e.preventDefault();
});

class StopSignal extends Error {}
class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

interface XhrResult {
  status: number;
  text: string;
  header: (name: string) => string | null;
}

function put(
  key: string,
  url: string,
  body: Blob | null,
  headers: Record<string, string>,
  onProgress?: (loaded: number) => void,
): Promise<XhrResult> {
  const internal = internals.get(key)!;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    internal.xhr = xhr;
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    if (onProgress) xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () =>
      resolve({ status: xhr.status, text: xhr.responseText, header: (n) => xhr.getResponseHeader(n) });
    xhr.onerror = () => reject(internal.stop ? new StopSignal() : new HttpError(translate("upload.errors.network"), 0));
    xhr.onabort = () => reject(new StopSignal());
    xhr.send(body);
  });
}

async function withRetry<T>(key: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await fn();
      if (get(key)?.retrying) patch(key, { retrying: undefined });
      return result;
    } catch (err) {
      if (err instanceof StopSignal) throw err;
      const status = err instanceof HttpError ? err.status : 0;
      const retriable = status === 0 || status === 408 || status === 429 || status >= 500;
      if (!retriable || attempt >= MAX_RETRIES) throw err;
      patch(key, { retrying: attempt + 1 });
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 15_000)));
      if (internals.get(key)?.stop) throw new StopSignal();
    }
  }
}

async function run(key: string) {
  const internal = internals.get(key)!;
  const item = get(key)!;
  patch(key, { state: "starting", error: undefined });

  try {
    if (!internal.serverId) {
      const started = await api<{ id: string; plan: Plan }>("/uploads", {
        method: "POST",
        json: { integrationId: item.integrationId, name: item.name, size: item.size },
      });
      internal.serverId = started.id;
      internal.plan = started.plan;
    }
    patch(key, { state: "uploading" });
    internal.lastSample = undefined;

    const plan = internal.plan!;
    let payload: Record<string, unknown> = {};
    if (plan.kind === "local") await uploadLocal(key, internal, plan);
    else if (plan.kind === "gdrive") payload = { remoteId: await uploadDrive(key, internal, plan) };
    else payload = { parts: await uploadS3(key, internal, plan) };

    patch(key, { state: "finishing", sent: item.size, speed: 0 });
    const { file } = await api<{ file: LibraryFile }>(`/uploads/${internal.serverId}/complete`, {
      method: "POST",
      json: payload,
    });
    patch(key, { state: "done", finishedAt: Date.now() });
    doneListeners.forEach((l) => l(file));
  } catch (err) {
    if (err instanceof StopSignal || internal.stop) {
      if (internal.stop === "pause") patch(key, { state: "paused", sent: internal.committed, speed: 0 });
    } else {
      patch(key, {
        state: "error",
        speed: 0,
        sent: internal.committed,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } finally {
    internal.xhr = undefined;
    pump();
  }
}

async function uploadLocal(key: string, internal: Internal, plan: Extract<Plan, { kind: "local" }>) {
  const { file, size } = get(key)!;
  const offsetRes = await api<{ offset: number }>(`/uploads/${internal.serverId}/offset`);
  internal.committed = offsetRes.offset;
  while (internal.committed < size) {
    const start = internal.committed;
    const end = Math.min(start + plan.chunkSize, size);
    const res = await withRetry(key, async () => {
      const r = await put(key, `/api/uploads/${internal.serverId}/chunk?offset=${start}`, file.slice(start, end), {
        "Content-Type": "application/octet-stream",
        "X-Cartucho-Locale": getLocale(),
      }, (loaded) => patch(key, { sent: start + loaded }));
      if (r.status >= 400 && r.status !== 409) throw new HttpError(JSON.parse(r.text || "{}").error ?? translate("upload.errors.status", { status: r.status }), r.status);
      return r;
    });
    internal.committed = JSON.parse(res.text).offset;
    patch(key, { sent: internal.committed });
  }
}

/** Asks Drive how many bytes it holds for this session. */
async function driveOffset(key: string, sessionUrl: string, size: number, fallback: number) {
  try {
    const r = await put(key, sessionUrl, null, { "Content-Range": `bytes */${size}` });
    if (r.status === 200 || r.status === 201) return size;
    const range = r.header("Range");
    return range ? Number(range.split("-")[1]) + 1 : r.status === 308 ? 0 : fallback;
  } catch (err) {
    if (err instanceof StopSignal) throw err;
    return fallback;
  }
}

async function uploadDrive(key: string, internal: Internal, plan: Extract<Plan, { kind: "gdrive" }>) {
  const { file, size } = get(key)!;
  if (internal.committed > 0) internal.committed = await driveOffset(key, plan.sessionUrl, size, internal.committed);

  while (true) {
    const start = internal.committed;
    const end = Math.min(start + plan.chunkSize, size);
    const res = await withRetry(key, async () => {
      const r = await put(
        key,
        plan.sessionUrl,
        file.slice(start, end),
        { "Content-Range": size === 0 ? "bytes */0" : `bytes ${start}-${end - 1}/${size}` },
        (loaded) => patch(key, { sent: start + loaded }),
      );
      if (r.status === 404 || r.status === 410) {
        throw new HttpError(translate("upload.errors.driveExpired"), r.status);
      }
      if (r.status !== 308 && r.status >= 300) throw new HttpError(translate("upload.errors.driveStatus", { status: r.status }), r.status);
      return r;
    });
    if (res.status === 200 || res.status === 201) {
      internal.committed = size;
      try {
        return JSON.parse(res.text).id as string;
      } catch {
        return undefined;
      }
    }
    const range = res.header("Range");
    internal.committed = range ? Number(range.split("-")[1]) + 1 : end;
    patch(key, { sent: internal.committed });
  }
}

async function uploadS3(key: string, internal: Internal, plan: Extract<Plan, { kind: "s3" }>) {
  const { file, size } = get(key)!;
  const done = new Set(internal.parts.map((p) => p.partNumber));
  for (let i = 0; i < plan.partUrls.length; i++) {
    const partNumber = i + 1;
    if (done.has(partNumber)) continue;
    const start = i * plan.partSize;
    const end = Math.min(start + plan.partSize, size);
    const res = await withRetry(key, async () => {
      const r = await put(key, plan.partUrls[i], file.slice(start, end), {}, (loaded) =>
        patch(key, { sent: internal.committed + loaded }),
      );
      if (r.status >= 300) throw new HttpError(translate("upload.errors.partRejected", { part: partNumber, status: r.status }), r.status);
      return r;
    });
    const etag = res.header("ETag");
    if (!etag) {
      throw new Error(translate("upload.errors.noEtag"));
    }
    internal.parts.push({ partNumber, etag });
    internal.committed += end - start;
    patch(key, { sent: internal.committed });
  }
  return internal.parts;
}
