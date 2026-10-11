# Cartucho

Private Tinfoil store for Nintendo Switch backups, with a web panel. pnpm monorepo:
`apps/server` (Hono + better-sqlite3, serves the API, the Tinfoil store under `/tinfoil` and the built panel)
and `apps/web` (React + Vite + Tailwind v4).

## Commands

- `pnpm -r typecheck` before every commit.
- Local stack: `docker compose up -d --build` (panel on `HOST_PORT`, default 3080); add `--profile s3` for MinIO.
- Production image is built by `.github/workflows/docker.yml` and published to `ghcr.io/5ucr4m/tinfoil-store`;
  Dokploy runs `docker-compose.prod.yml`.

## Commits

- Written in **English**, following **Conventional Commits**: `type(scope): summary`.
  - Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `style`, `test`, `build`, `ci`, `chore`.
  - Scopes when useful: `server`, `web`, `store` (Tinfoil-facing routes), `docker`, `ci`.
  - Summary in the imperative, lowercase, no trailing period, ≤ 72 chars. Body explains the why.
  - Breaking changes: `type(scope)!:` plus a `BREAKING CHANGE:` footer.
- Example: `fix(store): accept trailing slash on the tinfoil index path`

## Language

- **README and any repository documentation: English.**
- Code, comments and identifiers: English.
- The panel UI copy is **Brazilian Portuguese** (the app's audience). Keep new UI text in pt-BR.

## Things that bit us (keep them in mind)

- Tinfoil requests `/tinfoil/` with a trailing slash and does **not** send Basic auth when downloading
  files or images: file and image URLs in the index carry signed tokens (`routes/store.ts`).
- Tinfoil uses the `titledb` section of the index for names; New Games cover art comes from Tinfoil's own servers.
- Never delete a provider's source file before the copy is verified (`transfer.ts`).
