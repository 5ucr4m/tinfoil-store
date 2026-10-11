export type IntegrationType = "local" | "s3" | "gdrive";

export interface RemoteFile {
  remoteId: string;
  name: string;
  size: number;
}

export interface ByteRange {
  start: number;
  end: number; // inclusive
}

export type UploadPlan =
  | { kind: "local"; chunkSize: number; offset: number }
  | { kind: "gdrive"; sessionUrl: string; chunkSize: number }
  | { kind: "s3"; partSize: number; partUrls: string[] };

export interface UploadRef {
  uploadId: string;
  name: string;
  size: number;
  /** Driver-specific state persisted between init and complete. */
  data: Record<string, unknown>;
}

export interface AccountInfo {
  label?: string;
  usedBytes?: number;
  totalBytes?: number;
}

export interface Driver {
  /** Verifies credentials and reachability. Returns account details when available. */
  test(): Promise<AccountInfo>;
  list(): Promise<RemoteFile[]>;
  read(remoteId: string, range: ByteRange | null): Promise<ReadableStream<Uint8Array>>;
  /** URL the console can download from directly. Null means the server must proxy. */
  directUrl(remoteId: string, name: string): Promise<string | null>;
  remove(remoteId: string): Promise<void>;
  /** Renames in place. Returns the new remote ID (unchanged on Drive, new key/path on S3 and disk). */
  rename(remoteId: string, newName: string, size: number): Promise<string>;
  initUpload(ref: Omit<UploadRef, "data">, origin: string): Promise<{
    plan: UploadPlan;
    data: Record<string, unknown>;
  }>;
  completeUpload(ref: UploadRef, payload: Record<string, unknown>): Promise<RemoteFile>;
  abortUpload(ref: UploadRef): Promise<void>;
}
