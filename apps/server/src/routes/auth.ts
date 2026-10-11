import { Hono, type MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { z } from "zod";
import { hashPassword, secret, verifyPassword } from "../crypto";
import { getSetting, setSetting } from "../db";

const COOKIE = "cartucho_session";
const SESSION_DAYS = 30;

interface AdminSetting {
  hash: string;
  /** Bumped on password change to invalidate existing sessions. */
  generation: number;
}

const admin = () => getSetting<AdminSetting | null>("admin", null);

async function isAuthenticated(c: Parameters<MiddlewareHandler>[0]) {
  const value = await getSignedCookie(c, secret, COOKIE);
  if (!value) return false;
  const [exp, gen] = value.split(".").map(Number);
  return exp > Date.now() && gen === admin()?.generation;
}

async function startSession(c: Parameters<MiddlewareHandler>[0], generation: number) {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  const secure = (c.req.header("x-forwarded-proto") ?? new URL(c.req.url).protocol).startsWith("https");
  await setSignedCookie(c, COOKIE, `${exp}.${generation}`, secret, {
    httpOnly: true,
    sameSite: "Lax",
    secure,
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export const requireAdmin: MiddlewareHandler = async (c, next) => {
  if (!(await isAuthenticated(c))) return c.json({ error: "Sessão expirada. Entre novamente." }, 401);
  await next();
};

// Slows down password guessing: per-IP failure counter with growing lockout.
const failures = new Map<string, { count: number; until: number }>();
const clientIp = (c: Parameters<MiddlewareHandler>[0]) =>
  c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? c.req.header("x-real-ip") ?? "local";

const passwordSchema = z.object({ password: z.string().min(8, "Use pelo menos 8 caracteres") });

export const authRoutes = new Hono()
  .get("/state", async (c) =>
    c.json({ needsSetup: admin() === null, authenticated: await isAuthenticated(c) }),
  )
  .post("/setup", async (c) => {
    if (admin()) return c.json({ error: "O painel já tem senha definida." }, 409);
    const parsed = passwordSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    setSetting("admin", { hash: await hashPassword(parsed.data.password), generation: 1 });
    await startSession(c, 1);
    return c.json({ ok: true });
  })
  .post("/login", async (c) => {
    const ip = clientIp(c);
    const fail = failures.get(ip);
    if (fail && fail.until > Date.now()) {
      const seconds = Math.ceil((fail.until - Date.now()) / 1000);
      return c.json({ error: `Muitas tentativas. Tente de novo em ${seconds}s.` }, 429);
    }
    const current = admin();
    const { password } = (await c.req.json()) as { password?: string };
    if (!current || !password || !(await verifyPassword(password, current.hash))) {
      const count = (fail?.count ?? 0) + 1;
      failures.set(ip, { count, until: count >= 5 ? Date.now() + Math.min(2 ** (count - 5), 300) * 1000 : 0 });
      return c.json({ error: "Senha incorreta." }, 401);
    }
    failures.delete(ip);
    await startSession(c, current.generation);
    return c.json({ ok: true });
  })
  .post("/logout", (c) => {
    deleteCookie(c, COOKIE, { path: "/" });
    return c.json({ ok: true });
  })
  .post("/password", requireAdmin, async (c) => {
    const body = (await c.req.json()) as { current?: string; password?: string };
    const current = admin()!;
    if (!body.current || !(await verifyPassword(body.current, current.hash))) {
      return c.json({ error: "A senha atual não confere." }, 400);
    }
    const parsed = passwordSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    const generation = current.generation + 1;
    setSetting("admin", { hash: await hashPassword(parsed.data.password), generation });
    await startSession(c, generation);
    return c.json({ ok: true });
  });
