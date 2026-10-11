import { getLocale, translate } from "../i18n";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      // Server errors come back in the panel's language.
      "X-Cartucho-Locale": getLocale(),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth")) window.dispatchEvent(new Event("cartucho:logout"));
    throw new ApiError(body?.error ?? translate("common.errors.generic", { status: res.status }), res.status);
  }
  return body as T;
}

export type IntegrationType = "local" | "s3" | "gdrive";

export interface Integration {
  id: string;
  type: IntegrationType;
  name: string;
  status: "ok" | "error" | "pending" | "syncing";
  detail: { message?: string; account?: { label?: string; usedBytes?: number; totalBytes?: number } };
  lastSyncAt: number | null;
  createdAt: number;
  config: Record<string, unknown>;
  fileCount: number;
  totalBytes: number;
}

export type Kind = "base" | "update" | "dlc" | "unknown";

export interface LibraryFile {
  id: string;
  integrationId: string;
  integrationName: string;
  integrationType: IntegrationType;
  name: string;
  size: number;
  titleId: string | null;
  baseId: string | null;
  version: number | null;
  kind: Kind;
  createdAt: number;
  titleName: string | null;
  baseName: string | null;
  publisher: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  releaseDate: string | null;
  categories: string[];
}

export interface Tag {
  id: string;
  name: string;
  hue: number;
  keywords: string[];
  count: number;
}

export interface TagsResponse {
  tags: Tag[];
  /** Library item key (base title ID or "file:<id>") -> collections it belongs to. */
  items: Record<string, { id: string; auto: boolean }[]>;
}

export interface TitleInfo {
  id: string;
  name: string | null;
  publisher: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
}

export interface StoreUser {
  id: string;
  username: string;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface Console {
  uid: string;
  label: string | null;
  allowed: boolean;
  version: string | null;
  lastIp: string | null;
  firstSeen: number;
  lastSeen: number;
  hits: number;
}

export interface StoreSettings {
  publicUrl: string;
  welcomeMessage: string;
  requireApproval: boolean;
}

export interface Connection {
  baseUrl: string;
  protocol: string;
  host: string;
  port: string;
  path: string;
  directPath: string;
}

export interface Candidate {
  titleId: string;
  name: string;
  iconUrl: string | null;
  kind: Kind;
  score: number;
}

export interface Identification {
  source: "name" | "cnmt" | "ticket" | "fuzzy" | "none";
  confidence: "high" | "medium" | "low";
  titleId: string | null;
  kind: Kind;
  version: number | null;
  needsVersion: boolean;
  title: { id: string; name: string; iconUrl: string | null } | null;
  candidates: Candidate[];
  suggestedName: string | null;
}

export interface PendingFile {
  id: string;
  name: string;
  size: number;
  integrationName: string;
  integrationType: IntegrationType;
  identification: Identification | null;
}

export interface Transfer {
  id: string;
  fileId: string;
  name: string;
  size: number;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  mode: "move" | "copy";
  state: "queued" | "copying" | "finishing" | "done" | "error" | "canceled";
  copyStartedAt?: number;
  copied: number;
  error?: string;
  startedAt: number;
  finishedAt?: number;
}
