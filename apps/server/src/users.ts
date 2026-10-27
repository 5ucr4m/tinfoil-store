import { z } from "zod";
import { db } from "./db";

/**
 * Panel accounts. One credential per person: the same username and password sign in
 * to the panel and, when the account opts in, to the store from Tinfoil.
 */

export type Role = "admin" | "user";

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: Role;
  tinfoil_enabled: number;
  generation: number;
  created_at: number;
  last_login_at: number | null;
  tinfoil_last_used_at: number | null;
}

/** The account as the panel sees it. Never carries the hash. */
export interface PublicUser {
  id: string;
  username: string;
  role: Role;
  tinfoilEnabled: boolean;
  createdAt: number;
  lastLoginAt: number | null;
  tinfoilLastUsedAt: number | null;
}

export const publicUser = (row: UserRow): PublicUser => ({
  id: row.id,
  username: row.username,
  role: row.role,
  tinfoilEnabled: Boolean(row.tinfoil_enabled),
  createdAt: row.created_at,
  lastLoginAt: row.last_login_at,
  tinfoilLastUsedAt: row.tinfoil_last_used_at,
});

export const userById = (id: string) => db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;

// Usernames are typed on the Switch's on-screen keyboard, where the shift state is easy
// to get wrong: match and reserve them case-insensitively.
export const userByName = (username: string) =>
  db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username) as UserRow | undefined;

export const listUsers = () => db.prepare("SELECT * FROM users ORDER BY created_at").all() as UserRow[];

export const hasUsers = () => Boolean(db.prepare("SELECT 1 FROM users LIMIT 1").get());

export const adminCount = () =>
  (db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get() as { count: number }).count;

export const tinfoilUserByName = (username: string) =>
  db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE AND tinfoil_enabled = 1").get(username) as
    | UserRow
    | undefined;

export const hasTinfoilUsers = () => Boolean(db.prepare("SELECT 1 FROM users WHERE tinfoil_enabled = 1 LIMIT 1").get());

/** Shared validation. Messages are message keys, translated when the response is built. */
export const usernameSchema = z
  .string()
  .trim()
  .min(2, "errors.userTooShort")
  .max(32, "errors.userTooLong")
  .regex(/^[a-zA-Z0-9._-]+$/, "errors.userInvalidChars");

export const passwordSchema = z.string().min(8, "errors.passwordTooShort");
