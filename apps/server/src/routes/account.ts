import { Hono } from "hono";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../crypto";
import { db } from "../db";
import { baseUrl, fail, failIssue } from "../http";
import { sessionUser, startSession } from "../session";
import { passwordSchema, publicUser, userById } from "../users";
import { forgetStoreCredentials } from "./store";

/**
 * What a signed-in person can change about themselves, whatever their role:
 * their password and whether their account may open the store from Tinfoil.
 */

const changeSchema = z.object({ current: z.string().min(1, "errors.currentPasswordMismatch"), password: passwordSchema });

export const accountRoutes = new Hono()
  .get("/", (c) => c.json({ user: publicUser(userById(sessionUser(c).id)!) }))
  /** Connection fields for the Tinfoil card. Every account needs them; only admins edit the store. */
  .get("/connection", (c) => {
    const base = baseUrl(c);
    const url = new URL(base);
    return c.json({
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
  .post("/password", async (c) => {
    const me = userById(sessionUser(c).id)!;
    const parsed = changeSchema.safeParse(await c.req.json());
    if (!parsed.success) return failIssue(c, parsed.error.issues);
    if (!(await verifyPassword(parsed.data.current, me.password_hash))) {
      return fail(c, "errors.currentPasswordMismatch");
    }
    const generation = me.generation + 1;
    db.prepare("UPDATE users SET password_hash = ?, generation = ? WHERE id = ?").run(
      await hashPassword(parsed.data.password),
      generation,
      me.id,
    );
    // The old password is cached for the store's Basic auth; drop it right away.
    forgetStoreCredentials();
    await startSession(c, { id: me.id, generation });
    return c.json({ ok: true });
  })
  .put("/tinfoil", async (c) => {
    const me = userById(sessionUser(c).id)!;
    const { enabled } = (await c.req.json()) as { enabled?: boolean };
    db.prepare("UPDATE users SET tinfoil_enabled = ? WHERE id = ?").run(enabled ? 1 : 0, me.id);
    forgetStoreCredentials();
    return c.json({ user: publicUser(userById(me.id)!) });
  });
