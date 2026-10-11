import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
  UploadPartCommand,
  UploadPartCopyCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { basename } from "node:path";
import { AppError } from "../i18n";
import { isGameFile } from "../titles";
import type { ByteRange, Driver, RemoteFile, UploadRef } from "./types";

export interface S3Config {
  endpoint?: string;
  /** Endpoint the browser and the console reach, when different from the server's. */
  publicEndpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix?: string;
  forcePathStyle?: boolean;
  /** redirect: console downloads straight from the bucket via signed URL. */
  mode: "proxy" | "redirect";
}

const MIN_PART = 16 * 1024 * 1024;
const MAX_PARTS = 10_000;
const SIGNED_TTL = 6 * 60 * 60;
// CopyObject handles up to 5 GB; larger objects need a multipart copy.
const COPY_LIMIT = 5 * 1024 ** 3;
const COPY_PART = 1024 ** 3;

export class S3Driver implements Driver {
  private client: S3Client;
  private publicClient: S3Client;

  constructor(private config: S3Config) {
    const base = {
      region: config.region || "auto",
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      forcePathStyle: config.forcePathStyle ?? false,
      requestChecksumCalculation: "WHEN_REQUIRED" as const,
      responseChecksumValidation: "WHEN_REQUIRED" as const,
    };
    this.client = new S3Client({ ...base, endpoint: config.endpoint || undefined });
    this.publicClient = new S3Client({
      ...base,
      endpoint: config.publicEndpoint || config.endpoint || undefined,
    });
  }

  private get prefix() {
    const p = (this.config.prefix ?? "").replace(/^\/+/, "");
    return p && !p.endsWith("/") ? `${p}/` : p;
  }

  async test() {
    await this.client.send(
      new ListObjectsV2Command({ Bucket: this.config.bucket, Prefix: this.prefix, MaxKeys: 1 }),
    );
    return { label: `${this.config.bucket}/${this.prefix}` };
  }

  async list() {
    const out: RemoteFile[] = [];
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: this.prefix,
          ContinuationToken: token,
        }),
      );
      for (const obj of page.Contents ?? []) {
        if (obj.Key && isGameFile(obj.Key)) {
          out.push({ remoteId: obj.Key, name: basename(obj.Key), size: obj.Size ?? 0 });
        }
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return out;
  }

  async read(remoteId: string, range: ByteRange | null) {
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: remoteId,
        Range: range ? `bytes=${range.start}-${range.end}` : undefined,
      }),
    );
    if (!res.Body) throw new AppError("errors.s3EmptyObject");
    return res.Body.transformToWebStream() as ReadableStream<Uint8Array>;
  }

  async directUrl(remoteId: string, name: string) {
    if (this.config.mode !== "redirect") return null;
    return getSignedUrl(
      this.publicClient,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: remoteId,
        // Browsers save with the original name instead of the object key.
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      }),
      { expiresIn: SIGNED_TTL },
    );
  }

  async remove(remoteId: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: remoteId }));
  }

  /** S3 has no rename: server-side copy to the new key, then delete the old one. */
  async rename(remoteId: string, newName: string, size: number) {
    const dir = remoteId.includes("/") ? remoteId.slice(0, remoteId.lastIndexOf("/") + 1) : "";
    const key = `${dir}${basename(newName)}`;
    if (key === remoteId) return key;
    const source = `${this.config.bucket}/${remoteId.split("/").map(encodeURIComponent).join("/")}`;

    if (size <= COPY_LIMIT) {
      await this.client.send(new CopyObjectCommand({ Bucket: this.config.bucket, Key: key, CopySource: source }));
    } else {
      const { UploadId } = await this.client.send(
        new CreateMultipartUploadCommand({ Bucket: this.config.bucket, Key: key, ContentType: "application/octet-stream" }),
      );
      try {
        const parts = [];
        for (let start = 0, n = 1; start < size; start += COPY_PART, n++) {
          const end = Math.min(start + COPY_PART, size) - 1;
          const res = await this.client.send(
            new UploadPartCopyCommand({
              Bucket: this.config.bucket,
              Key: key,
              UploadId,
              PartNumber: n,
              CopySource: source,
              CopySourceRange: `bytes=${start}-${end}`,
            }),
          );
          parts.push({ PartNumber: n, ETag: res.CopyPartResult?.ETag });
        }
        await this.client.send(
          new CompleteMultipartUploadCommand({ Bucket: this.config.bucket, Key: key, UploadId, MultipartUpload: { Parts: parts } }),
        );
      } catch (err) {
        await this.client.send(new AbortMultipartUploadCommand({ Bucket: this.config.bucket, Key: key, UploadId })).catch(() => {});
        throw err;
      }
    }
    await this.remove(remoteId);
    return key;
  }

  async initUpload(ref: Omit<UploadRef, "data">) {
    const key = `${this.prefix}${basename(ref.name)}`;
    const created = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.config.bucket,
        Key: key,
        ContentType: "application/octet-stream",
      }),
    );
    const partSize = Math.max(MIN_PART, Math.ceil(ref.size / MAX_PARTS));
    const count = Math.max(1, Math.ceil(ref.size / partSize));
    const partUrls = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        getSignedUrl(
          this.publicClient,
          new UploadPartCommand({
            Bucket: this.config.bucket,
            Key: key,
            UploadId: created.UploadId,
            PartNumber: i + 1,
          }),
          { expiresIn: 24 * 60 * 60 },
        ),
      ),
    );
    return {
      plan: { kind: "s3" as const, partSize, partUrls },
      data: { key, s3UploadId: created.UploadId },
    };
  }

  /** Server-side part upload (moves between providers), using the internal endpoint. */
  async putPart(data: Record<string, unknown>, partNumber: number, body: Uint8Array) {
    const res = await this.client.send(
      new UploadPartCommand({
        Bucket: this.config.bucket,
        Key: data.key as string,
        UploadId: data.s3UploadId as string,
        PartNumber: partNumber,
        Body: body,
        ContentLength: body.length,
      }),
    );
    if (!res.ETag) throw new AppError("errors.s3MissingEtag", { part: partNumber });
    return res.ETag;
  }

  async completeUpload(ref: UploadRef, payload: Record<string, unknown>) {
    const parts = payload.parts as { partNumber: number; etag: string }[] | undefined;
    if (!parts?.length) throw new AppError("errors.s3NoParts");
    const key = ref.data.key as string;
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.config.bucket,
        Key: key,
        UploadId: ref.data.s3UploadId as string,
        MultipartUpload: {
          Parts: parts
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
        },
      }),
    );
    const head = await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
    return { remoteId: key, name: basename(key), size: head.ContentLength ?? ref.size };
  }

  async abortUpload(ref: UploadRef) {
    if (!ref.data.s3UploadId) return;
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.config.bucket,
        Key: ref.data.key as string,
        UploadId: ref.data.s3UploadId as string,
      }),
    );
  }
}
