import { Hono } from "hono";
import { z } from "zod";
import { generatePassword, hashPassword, newId } from "../crypto";
import { db, setSetting, storeSettings } from "../db";
import { baseUrl } from "../http";
import { forgetStoreCredentials } from "./store";

const userSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Use pelo menos 2 caracteres")
    .regex(/^[a-zA-Z0-9._-]+$/, "Use só letras, números, ponto, hífen ou sublinhado"),
});

const settingsSchema = z.object({
  publicUrl: z.string().trim().refine((v) => v === "" || /^https?:\/\/.+/.test(v), "Use uma URL começando com http(s)://"),
  welcomeMessage: z.string().max(500),
  requireApproval: z.boolean(),
});

export const accessRoutes = new Hono()
  .get("/users", (c) =>
    c.json({
      users: db
        .prepare("SELECT id, username, created_at AS createdAt, last_used_at AS lastUsedAt FROM store_users ORDER BY created_at")
        .all(),
    }),
  )
  .post("/users", async (c) => {
    const parsed = userSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    const exists = db.prepare("SELECT 1 FROM store_users WHERE username = ?").get(parsed.data.username);
    if (exists) return c.json({ error: "Já existe um usuário com esse nome." }, 409);
    const password = generatePassword();
    db.prepare("INSERT INTO store_users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)").run(
      newId(),
      parsed.data.username,
      await hashPassword(password),
      Date.now(),
    );
    return c.json({ username: parsed.data.username, password });
  })
  .post("/users/:id/reset", async (c) => {
    const user = db.prepare("SELECT username FROM store_users WHERE id = ?").get(c.req.param("id")) as
      | { username: string }
      | undefined;
    if (!user) return c.json({ error: "Usuário não encontrado." }, 404);
    const password = generatePassword();
    db.prepare("UPDATE store_users SET password_hash = ? WHERE id = ?").run(await hashPassword(password), c.req.param("id"));
    forgetStoreCredentials();
    return c.json({ username: user.username, password });
  })
  .delete("/users/:id", (c) => {
    db.prepare("DELETE FROM store_users WHERE id = ?").run(c.req.param("id"));
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
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    setSetting("store", { ...parsed.data, publicUrl: parsed.data.publicUrl.replace(/\/$/, "") });
    return c.json({ settings: storeSettings() });
  });
