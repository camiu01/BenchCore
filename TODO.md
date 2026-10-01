# TODO

Development task management for the personal publishing platform (blog frontend + standalone API).

## Done

- [x] Monorepo scaffold: `frontend/` (SvelteKit 3, TS strict) + `api/` (standalone `node:http` TS service) + `content/posts/` authoring folder, pnpm workspace (`pnpm-workspace.yaml`) #infra #dx
- [x] SvelteKit 3 config migration: `sveltekit()` plugin in `frontend/vite.config.ts`, `tsconfig.json` extends `$app/tsconfig`, relative imports (no deprecated `kit.alias`) #infra
- [x] TypeScript 5.9 pin (SvelteKit 3 tooling reads `ts.sys` APIs the TS 7 native port breaks) #infra
- [x] Engineering-log design system (`frontend/src/app.css`): monospace spec sheet, blueprint grid, light/dark/oled themes via `data-theme`, `.record`/`.stamp`/`.spec-table`/`.inventory-table` recipe #theme #ux
- [x] Theme preference helpers (`frontend/src/lib/theme.ts`): `THEMES`, `isTheme()`, `getStoredTheme()`, `applyTheme()` with SSR guards (+ `tests/theme.test.ts`) #theme #tests
- [x] Pre-paint theme script in `frontend/src/app.html` (no flash of default theme) #theme #perf
- [x] API health probe: `GET /health` + JSON 404/405 handling, `parsePort()` env parsing (`api/src/server.ts`, `api/src/index.ts`, `tests/health.test.ts`) #api #tests
- [x] Root DX: workspace scripts (`dev:frontend`, `dev:api`, `test`, `check`, `lint`, `build`), `.env.example` for both packages #dx
- [x] House style: `TODO.md` + `AGENTS.md` + GPL-3.0-only `LICENSE`, `@file`/`@brief` headers, TSDoc on functions, tabs/single quotes/semicolons, `tests/` mirroring `src/` #docs #style
- [x] TypeScript 5.9 pin (SvelteKit 3 tooling reads `ts.sys` APIs the TS 7 native port breaks); `$app/tsconfig` extends; `sveltekit()` plugin config; relative imports (no deprecated `kit.alias`); `$app/env` replaced by `process.env` (server-only); `Handle` from `@sveltejs/kit/hooks` #infra

### v0.2.0 milestone — Content pipeline & auth core (api, shipped)

- [x] Frontmatter extractor (`api/src/markdown/frontmatter.ts`): `+++` fences, structured `{ file, kind, message }` errors #content
- [x] Zod frontmatter schema (`api/src/markdown/schema.ts`): title, slug, description, status, tags, `published_at`, optional `cover_image` #content
- [x] Markdown render + sanitize (`api/src/markdown/render.ts`): `marked` + `sanitize-html` allowlist, excerpt, reading minutes, relative-image prefixing #content #security
- [x] Obsidian-style `[[slug]]` / `[[slug|label]]` wikilinks with broken-link marks plus backlink scan in the post service #content #ux
- [x] Password hashing (`api/src/auth/password.ts`): scrypt envelope, `timingSafeEqual` verify, tests #auth #security #tests
- [x] Sessions (`api/src/auth/session.ts`): 32-byte token, SHA-256 hash at rest, 30-day expiry, HttpOnly `SameSite=Lax` cookie helpers, tests #auth #security #tests

### v0.3.0 milestone — Database, API & media (api, shipped)

- [x] Drizzle schema (`api/src/db/schema.ts`): `users`, `posts`, `tags`, `post_tags`, `sessions`, `post_status` enum, slug uniques, `(status, published_at)` index; app-generated UUIDs, no DB extensions #db
- [x] Migration SQL via `drizzle-kit generate` (`api/drizzle/0000_parched_dormammu.sql`) #db
- [x] Repository interfaces + Drizzle + in-memory implementations (`api/src/db/repositories.ts`, `drizzle.ts`, `memory.ts`); services test with zero live DB #db #tests
- [x] Publishing rules (`api/src/posts/publishing.ts`): `isPublic()`, `canTransition()`, slug normalization; auto-stamp `publishedAt` on publish; unit tests #posts #tests
- [x] Post service (`api/src/posts/post-service.ts`): paginated published list, masked detail with backlinks, guarded create/update/delete #posts
- [x] Import service (`api/src/posts/import-service.ts`): file -> pipeline -> upsert by slug, per-file error report #content
- [x] `content:import`, `db:migrate` and `seed` scripts (`api/scripts/`): admin bootstrap from env plus sample import #dx
- [x] Auth endpoints: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` with Zod boundary validation #api #auth
- [x] Posts endpoints: `GET /api/posts` (paginated, published-only), `GET /api/posts/:slug` (404 masks drafts), `GET /api/tags`, `GET /api/admin/posts*` (session-guarded), `POST/PUT/DELETE /api/posts`, `POST /api/render` preview #api #posts
- [x] Media endpoints over the StorageProvider seam (`api/src/media/storage.ts` local-filesystem backend): `POST /api/media` (JSON base64, auth, 5 MiB cap, type allowlist), `GET /api/media/:key`, `DELETE /api/media/:key` #api #media
- [x] Router hardening: JSON body caps, cookie parsing, JSON 404/405/500 shapes; 42-test router + service suite #api #security #tests

### v0.4.0 milestone — Public site, admin & Docker (shipped)

- [x] Typed API client (`frontend/src/lib/api.ts`): Zod-validated DTOs, graceful `null` on API downtime (pages never 500) #frontend #api
- [x] Public routes: `/` recent records, `/posts` + pagination, `/posts/[slug]` with cover/backlinks/reading time, `/tags`, `/tags/[slug]`; offline stamps everywhere #frontend #ux
- [x] Reusable `Seo` + `DocShell`/`ThemePicker` components: title, description, canonical, Open Graph, Twitter/X cards #seo
- [x] `sitemap.xml`, `robots.txt`, `RSS` feed server routes (tolerant to API downtime) #seo
- [x] Login/logout pages + `hooks.server.ts` session resolve + `/admin` guard #frontend #auth
- [x] Obsidian-style admin editor (`PostEditor.svelte`): write mode, API-rendered read mode, status stamps, tag CSV, image upload with cursor insertion #admin #ux
- [x] `/admin` ledger, `/admin/posts/new`, `/admin/posts/[id]` (save/preview/delete/upload), `/admin/tags` registry #admin
- [x] Docker: `api/Dockerfile`, `frontend/Dockerfile` (adapter-node), `docker-compose.yml` (postgres 17 + api + frontend), `.dockerignore`; `pnpm docker:up` #ops

## Pending

### v0.5.0 milestone — Hardening & release

- [ ] CSRF Origin check on mutating API routes, rate limits, security headers #security
- [ ] Strict CSP + no-telemetry statement #security #docs
- [ ] Scheduled publishing + revisions groundwork (nullable `publish_at` job, `revisions` table sketch) #posts
- [ ] Full-text search (Postgres `tsvector`) #search
- [ ] Pluggable data storage: second StorageProvider backend (database blobs or S3) behind the existing seam #media #data
- [ ] CI: typecheck + tests + build on every push #ci
- [ ] Release 0.5.0: changelog from Conventional Commits, version bumps #release

### Deferred (do not implement yet)

- [ ] Comments #social
- [ ] Likes #social
- [ ] Categories #taxonomy
- [ ] Analytics #data
- [ ] Newsletters #data
- [ ] Multiple authors UI (schema already supports `author_id`) #auth
- [ ] Public API tokens #api
