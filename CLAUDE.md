# Cartucho

Private Tinfoil store for Nintendo Switch backups, with a web panel. Bun workspaces monorepo
(bun is the package manager; **Node 22 is the runtime**, because better-sqlite3 and sharp are native Node modules):
`apps/server` (Hono + better-sqlite3, serves the API, the Tinfoil store under `/tinfoil` and the built panel)
and `apps/web` (React + Vite + Tailwind v4).

## Commands

- `bun install` to install; `bun run typecheck` before every commit; `bun run build` builds both apps.
- The server is bundled by `apps/server/build.mjs` (esbuild): every JS dependency is inlined and only
  `better-sqlite3` and `sharp` stay external. A new native dependency must be added to that list and to the
  `runtime-deps` stage of the Dockerfile.
- Docker image: `node:22-alpine`, multi-stage (build → runtime-deps → final).
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
- Routes/URLs are English slugs (`/upload`, `/integrations`, `/access`, `/identify`, `/connect`, `/account`). Never use
  `/tinfoil*` or `/api*` for panel pages: those paths belong to the store and the API on a full page load. The old Portuguese paths
  only redirect; don't add new ones.

## Internationalization (required for every change)

The panel ships in **English (default), Brazilian Portuguese (`pt-BR`) and Spanish (`es`)**, switchable in the
sidebar, the mobile top bar and the sign-in screen. Every user-facing change must land in all three.

**Panel (`apps/web`)**
- Never hard-code visible text. JSX text, toasts, `aria-label`, `title`, `placeholder`, `alt`, menu items and
  error messages all go through `t("namespace.key")` (`useI18n()` inside components, `translate()` elsewhere).
  Inline markup uses `<Trans k=… components={{ … }} />`; counts use `{ one, other }` with a `count` param.
- Dictionaries live in `src/i18n/locales/{en,pt-BR,es}/<namespace>.ts`, one namespace per area. **English is
  the source of truth**: add the key in `en` first, then the same key in `pt-BR` and `es` (they are typed
  against `en`, so a missing key fails `tsc`). New namespace → register it in the three `index.ts` files.
- Numbers, sizes and dates use the current locale (`lib/format.ts`, `getLocale()`); never pass `"pt-BR"` or
  `"en-US"` literally. Store canonical data (genres, kinds) and translate at render time, so switching
  language relabels instantly.
- Keep untranslated: brand/product names (Tinfoil, Google Drive, YouTube), file-format tokens (NSP, NSZ, XCI,
  title ID) and Tinfoil's own UI labels (File Browser, New Games, Protocol/Host/Port/Path/Username), which
  must match what the user sees on the console.
- Copy: plain verbs, sentence case, specific; errors say what happened and how to fix it. Spanish is neutral
  Latin-American with "tú".

**Server (`apps/server`)**
- User-facing messages come from `src/i18n.ts` (`tr(locale, key, params)`), never inline strings. Code with no
  request at hand throws `AppError(key, params)`; routes translate with the request locale
  (`X-Cartucho-Locale` from the panel, Tinfoil's `Language` header on `/tinfoil`, else `Accept-Language`, else
  English). Persist translatable keys, not translated text.

**Before committing any UI change**
1. `bun run typecheck` (key parity between locales).
2. `cd apps/web && bun run i18n:check` (missing/extra keys, placeholder mismatches, hard-coded text) — must
   finish with 0 errors; review its warnings.
3. Open the changed screens in all three languages and read them.

## Accounts and permissions

- One `users` table: `role` is `admin` or `user` (read-only), plus `tinfoil_enabled` and `generation`
  (bumped on password change to invalidate that account's panel sessions). One credential per person: the
  same username and password sign in to the panel and to the store from Tinfoil.
- Usernames are matched and reserved `COLLATE NOCASE`: they are typed on the Switch's on-screen keyboard.
- **Permissions live in one place**: the `READ_ONLY` list in `apps/server/src/index.ts`. Everything under
  `/api` needs a session, and anything not listed there needs an admin, so a new endpoint is admin-only
  until you add it. Never gate a route by hand in its own router.
- Self-service is `/api/account` (own password, own Tinfoil access); managing other people is
  `/api/access/users` and admin-only. An admin can't change their own role or delete their own account.
- Changing a password, toggling Tinfoil access or removing an account must call `forgetStoreCredentials()`:
  the store caches verified Basic auth headers for ten minutes.
- The panel never holds a password in the clear, so the Tinfoil card shows where to get it instead of a
  copyable value (`StaticField`).
- Read-only accounts get no route to the pages they can't use, and no disabled buttons: write affordances
  are hidden, not greyed out (`useSession()` in the web app).

## Things that bit us (keep them in mind)

- Tinfoil requests `/tinfoil/` with a trailing slash and does **not** send Basic auth when downloading
  files or images: file and image URLs in the index carry signed tokens (`routes/store.ts`).
- Tinfoil uses the `titledb` section of the index for names; New Games cover art comes from Tinfoil's own servers.
- Never delete a provider's source file before the copy is verified (`transfer.ts`).
