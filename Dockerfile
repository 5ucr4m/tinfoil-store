# Node is the runtime (better-sqlite3 and sharp are native modules built for its ABI);
# bun is only the package manager.
ARG NODE_IMAGE=node:22-alpine
ARG BUN_IMAGE=oven/bun:1-alpine

FROM ${BUN_IMAGE} AS bun

# ---- Build: install workspaces, bundle the server, build the panel ----
FROM ${NODE_IMAGE} AS build
RUN apk add --no-cache python3 make g++
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile
COPY apps ./apps
RUN bun run build \
  && cd apps/server \
  && node -e ' \
    const pick = ["better-sqlite3", "sharp"]; \
    const read = (n) => JSON.parse(require("fs").readFileSync(`node_modules/${n}/package.json`, "utf8")); \
    const deps = Object.fromEntries(pick.map((n) => [n, read(n).version])); \
    require("fs").writeFileSync("/app/runtime-deps.json", JSON.stringify(deps)); \
    '

# ---- Runtime deps: only the native modules the server bundle leaves external ----
FROM ${NODE_IMAGE} AS runtime-deps
RUN apk add --no-cache python3 make g++
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /deps
# Exact versions resolved by the lockfile in the build stage.
COPY --from=build /app/runtime-deps.json /tmp/runtime-deps.json
RUN node -e ' \
  const dependencies = require("/tmp/runtime-deps.json"); \
  require("fs").writeFileSync("package.json", JSON.stringify({ \
    name: "cartucho-runtime", private: true, dependencies, trustedDependencies: Object.keys(dependencies) })); \
  ' \
  && bun install --production \
  # bun installs sharp's glibc and musl binaries; Alpine only loads the musl ones.
  && rm -rf node_modules/@img/sharp-linux-* node_modules/@img/sharp-libvips-linux-* \
  && rm -rf /root/.bun

# ---- Final image ----
FROM ${NODE_IMAGE}
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3000 \
    WEB_DIST=/app/web
COPY --from=runtime-deps /deps/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/web/dist ./web
RUN mkdir -p /data/games && chown -R node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
