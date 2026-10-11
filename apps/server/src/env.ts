import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const dataDir = resolve(process.env.DATA_DIR ?? join(process.cwd(), "data"));
mkdirSync(dataDir, { recursive: true });

export const env = {
  port: Number(process.env.PORT ?? 3000),
  dataDir,
  /** Secret used for session signing and token encryption. Generated on first boot when empty. */
  secret: process.env.APP_SECRET ?? "",
  /** Public base URL (e.g. https://store.example.com). Falls back to request headers. */
  publicUrl: (process.env.PUBLIC_URL ?? "").replace(/\/$/, ""),
  webDist: resolve(process.env.WEB_DIST ?? join(process.cwd(), "../web/dist")),
  isProd: process.env.NODE_ENV === "production",
};
