import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { env } from "./env";
import { fail, failWith } from "./http";
import { syncAll } from "./library";
import { accessRoutes } from "./routes/access";
import { authRoutes, requireAdmin } from "./routes/auth";
import { fileRoutes, titleRoutes } from "./routes/files";
import { identifyRoutes } from "./routes/identify";
import { gdriveCallback, integrationRoutes } from "./routes/integrations";
import { storeRoutes } from "./routes/store";
import { seedTags, tagRoutes } from "./routes/tags";
import { uploadRoutes } from "./routes/uploads";
import { refreshTitleDb, titleDbStatus } from "./titles";

seedTags();

// Clients disagree on trailing slashes (Tinfoil asks for "/tinfoil/"): route both the same way.
const app = new Hono({
  getPath: (req) => {
    const path = new URL(req.url).pathname;
    return path.length > 1 && path.endsWith("/") ? path.replace(/\/+$/, "") : path;
  },
});

app.onError((err, c) => {
  console.error(err);
  return failWith(c, err, 500);
});

app.get("/healthz", (c) => c.json({ ok: true }));
app.route("/tinfoil", storeRoutes);
app.route("/api/auth", authRoutes);

const api = new Hono();
api.use("*", requireAdmin);
api.route("/integrations/gdrive/callback", gdriveCallback);
api.route("/integrations", integrationRoutes);
api.route("/files", fileRoutes);
api.route("/titles", titleRoutes);
api.route("/uploads", uploadRoutes);
api.route("/tags", tagRoutes);
api.route("/identify", identifyRoutes);
api.route("/access", accessRoutes);
app.route("/api", api);
app.all("/api/*", (c) => fail(c, "errors.routeNotFound", 404));
// Never answer store requests with the panel's HTML: Tinfoil would list its assets as games.
app.all("/tinfoil/*", (c) => fail(c, "errors.storePathNotFound", 404));

if (existsSync(env.webDist)) {
  const indexHtml = readFileSync(join(env.webDist, "index.html"), "utf8");
  app.use("/assets/*", serveStatic({ root: env.webDist }));
  app.use("*", serveStatic({ root: env.webDist }));
  app.get("*", (c) => c.html(indexHtml));
}

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`Cartucho ouvindo em http://localhost:${info.port}`);
});

// Keep the library in step with files added outside the panel.
setTimeout(() => void syncAll(), 2_000);
setInterval(() => void syncAll(), 30 * 60_000);
if (["idle", "running"].includes(titleDbStatus().state)) setTimeout(() => void refreshTitleDb(), 5_000);
