import { Hono, type Context } from "hono";
import { z } from "zod";
import { hashPassword, newId, verifyPassword } from "../crypto";
import { db } from "../db";
import { fail, failIssue } from "../http";
import { currentUser, endSession, sessionOf, startSession } from "../session";
import { hasUsers, passwordSchema, userById, userByName, usernameSchema } from "../users";

// Slows down password guessing: per-IP failure counter with growing lockout.
const failures = new Map<string, { count: number; until: number }>();
const clientIp = (c: Context) =>
  c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? c.req.header("x-real-ip") ?? "local";

const credentialsSchema = z.object({ username: usernameSchema, password: passwordSchema });

export const authRoutes = new Hono()
  .get("/state", async (c) => c.json({ needsSetup: !hasUsers(), user: await currentUser(c) }))
  /** First boot only: creates the admin who then invites everyone else. */
  .post("/setup", async (c) => {
    if (hasUsers()) return fail(c, "errors.alreadySetUp", 409);
    const parsed = credentialsSchema.safeParse(await c.req.json());
    if (!parsed.success) return failIssue(c, parsed.error.issues);
    const id = newId();
    db.prepare(
      `INSERT INTO users (id, username, password_hash, role, tinfoil_enabled, generation, created_at, last_login_at)
       VALUES (?, ?, ?, 'admin', 0, 1, ?, ?)`,
    ).run(id, parsed.data.username, await hashPassword(parsed.data.password), Date.now(), Date.now());
    const created = userById(id)!;
    await startSession(c, created);
    return c.json({ user: sessionOf(created) });
  })
  .post("/login", async (c) => {
    const ip = clientIp(c);
    const lock = failures.get(ip);
    if (lock && lock.until > Date.now()) {
      return fail(c, "errors.tooManyAttempts", 429, { seconds: Math.ceil((lock.until - Date.now()) / 1000) });
    }
    const { username, password } = (await c.req.json()) as { username?: string; password?: string };
    const user = username ? userByName(username.trim()) : undefined;
    if (!user || !password || !(await verifyPassword(password, user.password_hash))) {
      const count = (lock?.count ?? 0) + 1;
      // Five free attempts, then 2s, 4s, 8s… capped at five minutes.
      failures.set(ip, { count, until: count >= 5 ? Date.now() + Math.min(2 ** (count - 5), 300) * 1000 : 0 });
      return fail(c, "errors.wrongCredentials", 401);
    }
    failures.delete(ip);
    db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(Date.now(), user.id);
    await startSession(c, user);
    return c.json({ user: sessionOf(user) });
  })
  .post("/logout", (c) => {
    endSession(c);
    return c.json({ ok: true });
  });
