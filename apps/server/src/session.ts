import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { secret } from "./crypto";
import { fail } from "./http";
import { userById, type Role, type UserRow } from "./users";

/**
 * Panel sessions. The signed cookie holds "<expiry>.<userId>.<generation>": the
 * generation is bumped when that user changes their password, which signs their
 * other browsers out without touching anyone else's session.
 */

const COOKIE = "cartucho_session";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  username: string;
  role: Role;
  tinfoilEnabled: boolean;
}

export const sessionOf = (row: UserRow): SessionUser => ({
  id: row.id,
  username: row.username,
  role: row.role,
  tinfoilEnabled: Boolean(row.tinfoil_enabled),
});

export async function startSession(c: Context, user: { id: string; generation: number }) {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  const secure = (c.req.header("x-forwarded-proto") ?? new URL(c.req.url).protocol).startsWith("https");
  await setSignedCookie(c, COOKIE, `${exp}.${user.id}.${user.generation}`, secret, {
    httpOnly: true,
    sameSite: "Lax",
    secure,
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export const endSession = (c: Context) => deleteCookie(c, COOKIE, { path: "/" });

/** The signed-in account, or null when the cookie is absent, expired or stale. */
export async function currentUser(c: Context): Promise<SessionUser | null> {
  const value = await getSignedCookie(c, secret, COOKIE);
  if (!value) return null;
  const [expRaw, userId, genRaw] = value.split(".");
  if (!userId || Number(expRaw) <= Date.now()) return null;
  const row = userById(userId);
  if (!row || row.generation !== Number(genRaw)) return null;
  return sessionOf(row);
}

/** Set by requireSession; read it with `sessionUser`. */
const USER_VAR = "user";

export const sessionUser = (c: Context) => c.get(USER_VAR as never) as SessionUser;

export const requireSession: MiddlewareHandler = async (c, next) => {
  const user = await currentUser(c);
  if (!user) return fail(c, "errors.sessionExpired", 401);
  c.set(USER_VAR as never, user as never);
  await next();
};

/** Runs after requireSession: anything that changes the library or other accounts. */
export const requireAdmin: MiddlewareHandler = async (c, next) => {
  if (sessionUser(c)?.role !== "admin") return fail(c, "errors.adminOnly", 403);
  await next();
};
