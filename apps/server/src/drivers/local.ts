import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, readdir, rename, rm, stat, statfs, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { AppError } from "../i18n";
import { isGameFile } from "../titles";
import type { Driver, RemoteFile } from "./types";

export interface LocalConfig {
  path: string;
}

const TMP_DIR = ".cartucho-uploads";
const CHUNK_SIZE = 16 * 1024 * 1024;

export class LocalDriver implements Driver {
  private root: string;

  constructor(config: LocalConfig) {
    this.root = resolve(config.path);
  }

  private safe(rel: string) {
    const full = resolve(this.root, rel);
    if (full !== this.root && !full.startsWith(this.root + sep)) throw new AppError("errors.invalidPath");
    return full;
  }

  async test() {
    await mkdir(this.root, { recursive: true });
    const fs = await statfs(this.root);
    const total = fs.blocks * fs.bsize;
    return { label: this.root, totalBytes: total, usedBytes: total - fs.bavail * fs.bsize };
  }

  async list() {
    const out: RemoteFile[] = [];
    const walk = async (dir: string) => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else if (isGameFile(entry.name)) {
          out.push({
            remoteId: relative(this.root, full),
            name: entry.name,
            size: (await stat(full)).size,
          });
        }
      }
    };
    await mkdir(this.root, { recursive: true });
    await walk(this.root);
    return out;
  }

  async read(remoteId: string, range: { start: number; end: number } | null) {
    const path = this.safe(remoteId);
    // Fail here, not mid-stream, so the store can fall back to a replica.
    await stat(path);
    const stream = createReadStream(path, range ?? undefined);
    return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  }

  async directUrl() {
    return null;
  }

  async remove(remoteId: string) {
    await rm(this.safe(remoteId), { force: true });
  }

  async rename(remoteId: string, newName: string) {
    const from = this.safe(remoteId);
    const dir = dirname(from);
    let target = this.safe(join(relative(this.root, dir), basename(newName)));
    for (let i = 1; existsSync(target) && target !== from; i++) {
      const ext = extname(newName);
      target = this.safe(join(relative(this.root, dir), `${basename(newName, ext)} (${i})${ext}`));
    }
    await rename(from, target);
    return relative(this.root, target);
  }

  private tmpPath(uploadId: string) {
    return join(this.root, TMP_DIR, uploadId);
  }

  async initUpload(ref: { uploadId: string }) {
    const tmp = this.tmpPath(ref.uploadId);
    await mkdir(dirname(tmp), { recursive: true });
    await writeFile(tmp, "");
    return { plan: { kind: "local" as const, chunkSize: CHUNK_SIZE, offset: 0 }, data: {} };
  }

  /** Appends a chunk. Chunks must arrive in order; returns the new offset. */
  async writeChunk(uploadId: string, offset: number, body: ReadableStream<Uint8Array>) {
    const tmp = this.tmpPath(uploadId);
    const current = (await stat(tmp)).size;
    if (current !== offset) return { ok: false as const, offset: current };
    await pipeline(
      Readable.fromWeb(body as import("node:stream/web").ReadableStream),
      createWriteStream(tmp, { flags: "a" }),
    );
    return { ok: true as const, offset: (await stat(tmp)).size };
  }

  async currentOffset(uploadId: string) {
    return (await stat(this.tmpPath(uploadId))).size;
  }

  async completeUpload(ref: { uploadId: string; name: string; size: number }) {
    const tmp = this.tmpPath(ref.uploadId);
    const size = (await stat(tmp)).size;
    if (size !== ref.size) throw new AppError("errors.uploadIncomplete", { received: size, expected: ref.size });

    let name = basename(ref.name);
    let target = this.safe(name);
    for (let i = 1; existsSync(target); i++) {
      const ext = extname(ref.name);
      name = `${basename(ref.name, ext)} (${i})${ext}`;
      target = this.safe(name);
    }
    await rename(tmp, target);
    return { remoteId: relative(this.root, target), name, size };
  }

  async abortUpload(ref: { uploadId: string }) {
    await rm(this.tmpPath(ref.uploadId), { force: true });
  }
}
