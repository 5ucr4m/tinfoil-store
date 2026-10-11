import { build } from "esbuild";

// Single-file bundle with every JS dependency inlined, so the runtime image only
// needs the native modules below in node_modules.
await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  external: ["better-sqlite3", "sharp"],
  // CommonJS dependencies (AWS SDK, stream-json) call require() at runtime.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "info",
});
