import { Hono } from "hono";
import { z } from "zod";
import { generatePassword, hashPassword, newId } from "../crypto";
import { db, setSetting, storeSettings } from "../db";
import { baseUrl, fail, failIssue } from "../http";
import { sessionUser } from "../session";
import { adminCount, listUsers, publicUser, userById, userByName, usernameSchema } from "../users";
import { forgetStoreCredentials } from "./store";

const userSchema = z.object({ username: usernameSchema, role: z.enum(["admin", "user"]).default("user") });

const patchSchema = z.object({ role: z.enum(["admin", "user"]).optional(), tinfoilEnabled: z.boolean().optional() });

const settingsSchema = z.object({
  publicUrl: z.string().trim().refine((v) => v === "" || /^https?:\/\/.+/.test(v), "errors.publicUrlInvalid"),
  welcomeMessage: z.string().max(500, "errors.welcomeTooLong"),
  requireApproval: z.boolean(),
});

export const accessRoutes = new Hono()
  .get("/users", (c) => c.json({ users: listUsers().map(publicUser) }))
  /*
   * New accounts get a generated password, shown once. It is deliberately Switch-friendly:
   * the same password is typed on the console's on-screen keyboard when Tinfoil is on.
   */
  .post("/users", async (c) => {
    const parsed = userSchema.safeParse(await c.req.json());
    if (!parsed.success) return failIssue(c, parsed.error.issues);
    if (userByName(parsed.data.username)) return fail(c, "errors.userExists", 409);
    const password = generatePassword();
    db.prepare(
      `INSERT INTO users (id, username, password_hash, role, tinfoil_enabled, generation, created_at)
       VALUES (?, ?, ?, ?, 0, 1, ?)`,
    ).run(newId(), parsed.data.username, await hashPassword(password), parsed.data.role, Date.now());
    return c.json({ username: parsed.data.username, password, role: parsed.data.role });
  })
  .post("/users/:id/reset", async (c) => {
    const user = userById(c.req.param("id"));
    if (!user) return fail(c, "errors.userNotFound", 404);
    const password = generatePassword();
    // Signs that account out of every browser, and drops the cached store credentials.
    db.prepare("UPDATE users SET password_hash = ?, generation = generation + 1 WHERE id = ?").run(
      await hashPassword(password),
      user.id,
    );
    forgetStoreCredentials();
    return c.json({ username: user.username, password, role: user.role });
  })
  .patch("/users/:id", async (c) => {
    const user = userById(c.req.param("id"));
    if (!user) return fail(c, "errors.userNotFound", 404);
    const parsed = patchSchema.safeParse(await c.req.json());
    if (!parsed.success) return failIssue(c, parsed.error.issues);
    const { role, tinfoilEnabled } = parsed.data;
    if (role && role !== user.role) {
      // An admin who demotes themselves would lock the panel's own settings away.
      if (user.id === sessionUser(c).id) return fail(c, "errors.cannotChangeOwnRole", 409);
      if (user.role === "admin" && adminCount() <= 1) return fail(c, "errors.lastAdmin", 409);
      db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, user.id);
    }
    if (tinfoilEnabled !== undefined) {
      db.prepare("UPDATE users SET tinfoil_enabled = ? WHERE id = ?").run(tinfoilEnabled ? 1 : 0, user.id);
      forgetStoreCredentials();
    }
    return c.json({ user: publicUser(userById(user.id)!) });
  })
  .delete("/users/:id", (c) => {
    const user = userById(c.req.param("id"));
    if (!user) return fail(c, "errors.userNotFound", 404);
    if (user.id === sessionUser(c).id) return fail(c, "errors.cannotRemoveSelf", 409);
    if (user.role === "admin" && adminCount() <= 1) return fail(c, "errors.lastAdmin", 409);
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    forgetStoreCredentials();
    return c.json({ ok: true });
  })
  .get("/consoles", (c) =>
    c.json({
      consoles: db
        .prepare(
          `SELECT uid, label, allowed, version, last_ip AS lastIp, first_seen AS firstSeen,
                  last_seen AS lastSeen, hits FROM consoles ORDER BY last_seen DESC`,
        )
        .all()
        .map((row) => ({ ...(row as object), allowed: Boolean((row as { allowed: number }).allowed) })),
    }),
  )
  .patch("/consoles/:uid", async (c) => {
    const body = (await c.req.json()) as { label?: string; allowed?: boolean };
    const uid = c.req.param("uid");
    if (body.label !== undefined) db.prepare("UPDATE consoles SET label = ? WHERE uid = ?").run(body.label.trim() || null, uid);
    if (body.allowed !== undefined) db.prepare("UPDATE consoles SET allowed = ? WHERE uid = ?").run(body.allowed ? 1 : 0, uid);
    return c.json({ ok: true });
  })
  .delete("/consoles/:uid", (c) => {
    db.prepare("DELETE FROM consoles WHERE uid = ?").run(c.req.param("uid"));
    return c.json({ ok: true });
  })
  .get("/settings", (c) => {
    const base = baseUrl(c);
    const url = new URL(base);
    return c.json({
      settings: storeSettings(),
      connection: {
        baseUrl: base,
        protocol: url.protocol.replace(":", ""),
        host: url.hostname,
        port: url.port || (url.protocol === "https:" ? "443" : "80"),
        path: "/tinfoil",
        directPath: "/tinfoil/gdrive",
      },
    });
  })
  .put("/settings", async (c) => {
    const parsed = settingsSchema.safeParse(await c.req.json());
    if (!parsed.success) return failIssue(c, parsed.error.issues);
    setSetting("store", { ...parsed.data, publicUrl: parsed.data.publicUrl.replace(/\/$/, "") });
    return c.json({ settings: storeSettings() });
  });
