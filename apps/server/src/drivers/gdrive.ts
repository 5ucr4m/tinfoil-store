import { AppError } from "../i18n";
import { isGameFile } from "../titles";
import type { ByteRange, Driver, RemoteFile, UploadRef } from "./types";

export interface GDriveConfig {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
  /** Root folder scanned and used for uploads. Created on connect when empty. */
  folderId?: string;
  folderName?: string;
  email?: string;
}

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const SCOPE = "https://www.googleapis.com/auth/drive";
const FOLDER_MIME = "application/vnd.google-apps.folder";
// Drive requires resumable chunks in multiples of 256 KiB.
const CHUNK_SIZE = 32 * 1024 * 1024;

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export function gdriveAuthUrl(config: GDriveConfig, redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: `${SCOPE} openid email`,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function gdriveExchangeCode(config: GDriveConfig, code: string, redirectUri: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as { refresh_token?: string; error_description?: string; error?: string };
  if (!res.ok || !json.refresh_token) {
    if (json.error_description ?? json.error) throw new Error(json.error_description ?? json.error);
    throw new AppError("errors.googleNoRefreshToken");
  }
  return json.refresh_token;
}

export class GDriveDriver implements Driver {
  constructor(
    private id: string,
    private config: GDriveConfig,
  ) {}

  private async token() {
    const cached = tokenCache.get(this.id);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    if (!this.config.refreshToken) throw new AppError("errors.googleNotConnected");
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!res.ok || !json.access_token) {
      if (json.error_description) throw new Error(json.error_description);
      throw new AppError("errors.googleRefreshFailed");
    }
    tokenCache.set(this.id, {
      token: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    });
    return json.access_token;
  }

  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${await this.token()}`, ...init.headers },
    });
    if (!res.ok) {
      const body = await res.text();
      let message = body;
      try {
        message = JSON.parse(body).error?.message ?? body;
      } catch {}
      throw new Error(`Google Drive (${res.status}): ${message}`);
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  /** Finds or creates the root folder. Returns the config fields to persist. */
  async ensureFolder(name = "Tinfoil") {
    if (this.config.folderId) return { folderId: this.config.folderId, folderName: this.config.folderName };
    const q = `name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and 'root' in parents and trashed = false`;
    const found = await this.api<{ files: { id: string }[] }>(
      `/files?q=${encodeURIComponent(q)}&fields=files(id)`,
    );
    const folderId =
      found.files[0]?.id ??
      (
        await this.api<{ id: string }>("/files?fields=id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, mimeType: FOLDER_MIME }),
        })
      ).id;
    this.config.folderId = folderId;
    this.config.folderName = name;
    return { folderId, folderName: name };
  }

  async test() {
    const about = await this.api<{
      user: { emailAddress: string };
      storageQuota: { limit?: string; usage: string };
    }>("/about?fields=user(emailAddress),storageQuota(limit,usage)");
    return {
      label: about.user.emailAddress,
      usedBytes: Number(about.storageQuota.usage),
      totalBytes: about.storageQuota.limit ? Number(about.storageQuota.limit) : undefined,
    };
  }

  async list() {
    const { folderId } = await this.ensureFolder();
    const out: RemoteFile[] = [];
    const queue = [folderId];
    while (queue.length) {
      const parent = queue.shift()!;
      let pageToken: string | undefined;
      do {
        const params = new URLSearchParams({
          q: `'${parent}' in parents and trashed = false`,
          fields: "nextPageToken, files(id, name, size, mimeType)",
          pageSize: "1000",
          supportsAllDrives: "true",
          includeItemsFromAllDrives: "true",
        });
        if (pageToken) params.set("pageToken", pageToken);
        const page = await this.api<{
          nextPageToken?: string;
          files: { id: string; name: string; size?: string; mimeType: string }[];
        }>(`/files?${params}`);
        for (const f of page.files) {
          if (f.mimeType === FOLDER_MIME) queue.push(f.id);
          else if (isGameFile(f.name)) out.push({ remoteId: f.id, name: f.name, size: Number(f.size ?? 0) });
        }
        pageToken = page.nextPageToken;
      } while (pageToken);
    }
    return out;
  }

  async read(remoteId: string, range: ByteRange | null) {
    const res = await fetch(`${API}/files/${remoteId}?alt=media&supportsAllDrives=true`, {
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}),
      },
    });
    if (!res.ok || !res.body) throw new Error(`Google Drive (${res.status}): ${await res.text()}`);
    return res.body;
  }

  async directUrl() {
    return null;
  }

  async remove(remoteId: string) {
    await this.api(`/files/${remoteId}?supportsAllDrives=true`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
  }

  async rename(remoteId: string, newName: string) {
    await this.api(`/files/${remoteId}?supportsAllDrives=true&fields=id`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    return remoteId;
  }

  /**
   * Opens a resumable session bound to the panel's origin, so the browser can
   * PUT chunks straight to Google without going through this server.
   */
  async initUpload(ref: Omit<UploadRef, "data">, origin: string) {
    const { folderId } = await this.ensureFolder();
    const res = await fetch(`${UPLOAD_API}/files?uploadType=resumable&supportsAllDrives=true`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "application/octet-stream",
        "X-Upload-Content-Length": String(ref.size),
        Origin: origin,
      },
      body: JSON.stringify({ name: ref.name, parents: [folderId] }),
    });
    const sessionUrl = res.headers.get("location");
    if (!res.ok || !sessionUrl) throw new AppError("errors.googleUploadRejected", { detail: await res.text() });
    return {
      plan: { kind: "gdrive" as const, sessionUrl, chunkSize: CHUNK_SIZE },
      data: { sessionUrl, folderId },
    };
  }

  async completeUpload(ref: UploadRef, payload: Record<string, unknown>) {
    let fileId = typeof payload.remoteId === "string" ? payload.remoteId : undefined;
    if (!fileId) {
      // Browser could not read the final response: look the file up by name.
      const q = `name = '${ref.name.replace(/'/g, "\\'")}' and '${ref.data.folderId}' in parents and trashed = false`;
      const found = await this.api<{ files: { id: string }[] }>(
        `/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc&fields=files(id)`,
      );
      fileId = found.files[0]?.id;
    }
    if (!fileId) throw new AppError("errors.driveFileMissingAfterUpload");
    const file = await this.api<{ id: string; name: string; size: string }>(
      `/files/${fileId}?fields=id,name,size&supportsAllDrives=true`,
    );
    return { remoteId: file.id, name: file.name, size: Number(file.size) };
  }

  async abortUpload(ref: UploadRef) {
    if (ref.data.sessionUrl) await fetch(ref.data.sessionUrl as string, { method: "DELETE" }).catch(() => {});
  }
}
