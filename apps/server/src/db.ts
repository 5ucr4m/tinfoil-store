import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";
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

-- Panel accounts. 'admin' changes the library; 'user' browses and downloads.
-- One credential per person: the same username and password sign in here and in Tinfoil.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  -- Off by default: the store only accepts accounts that opted in.
  tinfoil_enabled INTEGER NOT NULL DEFAULT 0,
  -- Bumped on password change to invalidate that user's panel sessions.
  generation INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  tinfoil_last_used_at INTEGER
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

/*
 * One-time move from the single panel password plus Tinfoil-only "store users" to
 * panel accounts with roles. Ids and password hashes are carried over, so signed
 * download links and the consoles already configured keep working.
 */
function migrateAccounts() {
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
    (t) => t.name,
  );
  const legacyAdmin = db.prepare("SELECT value FROM settings WHERE key = 'admin'").get() as { value: string } | undefined;
  const hasStoreUsers = tables.includes("store_users");
  if (!legacyAdmin && !hasStoreUsers) return;

  const taken = new Set(
    (db.prepare("SELECT username FROM users").all() as { username: string }[]).map((u) => u.username.toLowerCase()),
  );
  const claim = (wanted: string) => {
    let name = wanted;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${wanted}-${n}`;
    taken.add(name.toLowerCase());
    return name;
  };
  const insert = db.prepare(
    `INSERT INTO users (id, username, password_hash, role, tinfoil_enabled, generation, created_at,
                        last_login_at, tinfoil_last_used_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.transaction(() => {
    if (legacyAdmin) {
      const { hash, generation } = JSON.parse(legacyAdmin.value) as { hash: string; generation: number };
      insert.run(randomBytes(9).toString("base64url"), claim("admin"), hash, "admin", 0, generation || 1, Date.now(), null, null);
      // The hash now lives in users; keeping the setting would leave two sources of truth.
      db.prepare("DELETE FROM settings WHERE key = 'admin'").run();
    }
    if (hasStoreUsers) {
      const legacy = db
        .prepare("SELECT id, username, password_hash, created_at, last_used_at FROM store_users ORDER BY created_at")
        .all() as { id: string; username: string; password_hash: string; created_at: number; last_used_at: number | null }[];
      for (const u of legacy) {
        // Their short, Switch-typeable password also signs them into the panel until they change it.
        insert.run(u.id, claim(u.username), u.password_hash, "user", 1, 1, u.created_at, null, u.last_used_at);
      }
      // Renamed rather than dropped: a rollback can still read it.
      db.exec("ALTER TABLE store_users RENAME TO store_users_legacy");
    }
  })();
  console.log("[db] migrated panel accounts to the users table");
}

migrateAccounts();

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
