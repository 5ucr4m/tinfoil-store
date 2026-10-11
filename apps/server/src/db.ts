import Database from "better-sqlite3";
import { join } from "node:path";
import { env } from "./env";

export const db = new Database(join(env.dataDir, "cartucho.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  status_detail TEXT,
  last_sync_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  remote_id TEXT NOT NULL,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  title_id TEXT,
  base_id TEXT,
  version INTEGER,
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (integration_id, remote_id)
);
CREATE INDEX IF NOT EXISTS files_base ON files(base_id);

CREATE TABLE IF NOT EXISTS titles (
  id TEXT PRIMARY KEY,
  name TEXT,
  publisher TEXT,
  icon_url TEXT,
  banner_url TEXT,
  release_date TEXT,
  categories TEXT,
  description TEXT,
  screenshots TEXT,
  developer TEXT,
  players INTEGER,
  raw TEXT
);

-- User collections (e.g. "Metroidvania"). Keywords auto-match title name/description.
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  hue INTEGER NOT NULL,
  keywords TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

-- Manual overrides on top of keyword matching. item_key is the base title ID,
-- or "file:<id>" for files without a title ID.
CREATE TABLE IF NOT EXISTS tag_items (
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('add', 'remove')),
  PRIMARY KEY (tag_id, item_key)
);

-- Last identification run per file (suggested title, candidates, confidence).
CREATE TABLE IF NOT EXISTS identifications (
  file_id TEXT PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Rename history, kept for undo.
CREATE TABLE IF NOT EXISTS renames (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  old_name TEXT NOT NULL,
  new_name TEXT NOT NULL,
  undone INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS store_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE TABLE IF NOT EXISTS consoles (
  uid TEXT PRIMARY KEY,
  label TEXT,
  allowed INTEGER NOT NULL DEFAULT 0,
  version TEXT,
  last_ip TEXT,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  state TEXT NOT NULL,
  data TEXT,
  created_at INTEGER NOT NULL
);
`);

// Columns added after the first release. A titledb refresh fills them in.
const titleColumns = (db.prepare("PRAGMA table_info(titles)").all() as { name: string }[]).map((c) => c.name);
const newColumns = {
  categories: "TEXT",
  description: "TEXT",
  screenshots: "TEXT",
  developer: "TEXT",
  players: "INTEGER",
  raw: "TEXT",
};
for (const [column, type] of Object.entries(newColumns)) {
  if (!titleColumns.includes(column)) {
    db.exec(`ALTER TABLE titles ADD COLUMN ${column} ${type}`);
    db.prepare("DELETE FROM settings WHERE key = 'titledb'").run();
  }
}

export function getSetting<T>(key: string, fallback: T): T {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row ? (JSON.parse(row.value) as T) : fallback;
}

export function setSetting(key: string, value: unknown) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, JSON.stringify(value));
}

export interface StoreSettings {
  publicUrl: string;
  welcomeMessage: string;
  requireApproval: boolean;
}

export const defaultStoreSettings: StoreSettings = {
  publicUrl: "",
  welcomeMessage: "",
  requireApproval: false,
};

export const storeSettings = () => ({
  ...defaultStoreSettings,
  ...getSetting<Partial<StoreSettings>>("store", {}),
});
