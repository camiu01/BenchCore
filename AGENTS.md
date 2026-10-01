# AGENTS.md — PERSONAL-PUBLISHING-PLATFORM

## Quick start
```bash
pnpm install
pnpm dev:frontend        # SvelteKit site on :5173
pnpm dev:api             # API service on :3001 (GET /health)
pnpm test                # recursive: frontend + api vitest suites
pnpm check               # frontend svelte-check
pnpm lint                # frontend eslint
pnpm build               # recursive builds
pnpm seed                # admin bootstrap + content import (needs DATABASE_URL)
pnpm content:import      # import content/posts into PostgreSQL
pnpm docker:up           # full stack via compose (postgres + api + frontend)
```

## Architecture
- pnpm monorepo: `frontend/` (SvelteKit UI, zero direct DB access) + `api/`
  (standalone `node:http` TypeScript service, owns Drizzle + content pipeline).
- Markdown + TOML (`content/posts/*.md`) is the authoring format; PostgreSQL is
  the runtime source of truth. Frontend renders API data only.
- Entrypoints: `frontend/src/routes/` (pages) and `api/src/index.ts` (server boot).

## Directory layout
```
content/posts/              # authoring source (*.md + +++ TOML frontmatter)
frontend/
  src/
    lib/theme.ts            # presentation-only theme state (localStorage + data-theme)
    lib/api.ts              # typed API client, Zod-validated DTOs (server-only)
    lib/site.ts             # canonical base URL helper (server-only)
    lib/components/         # DocShell, ThemePicker, Seo, PostEditor (write/preview)
    lib/server/admin-api.ts # cookie-forwarding admin client (server-only)
    hooks.server.ts         # session resolve + /admin guard
    routes/(public)/        # /, /posts, /posts/[slug], /tags, /tags/[slug]
    routes/login/           # login action (forwards API Set-Cookie)
    routes/logout/          # logout endpoint
    routes/admin/           # deck, posts/new, posts/[id], tags (guarded)
    routes/api/             # none: API lives in api/, never in SvelteKit
    routes/*.xml|robots.txt # sitemap, RSS, robots server routes
  tests/                    # mirrors src/ (smoke.test.ts, theme.test.ts)
api/
  src/
    server.ts               # router: /health, /api/auth/*, /api/posts*, /api/media*
    index.ts                # boot only (repos + storage wiring, listen)
    db/schema.ts            # Drizzle tables: users, posts, tags, post_tags, sessions
    db/repositories.ts      # repository interfaces (DB-free contracts)
    db/drizzle.ts           # Drizzle implementations (only SQL lives here)
    db/memory.ts            # in-memory repos for tests
    db/client.ts            # lazy postgres client (DATABASE_URL)
    markdown/               # frontmatter.ts, schema.ts (Zod), render.ts (wikilinks + sanitize)
    posts/                  # publishing.ts (rules), post-service.ts, import-service.ts
    auth/                   # password.ts (scrypt), session.ts (token + cookie)
    media/storage.ts        # StorageProvider seam + local-filesystem backend
  scripts/                  # import.ts (content:import), migrate.ts, seed.ts (admin bootstrap)
  drizzle/                  # generated migrations (drizzle-kit, no live DB needed)
  tests/                    # mirrors src/
  Dockerfile                # node:22-alpine, migrate-on-boot, serve dist
TODO.md                     # roadmap: Done (with #tags) + Pending per milestone
docker-compose.yml          # postgres 17 + api + frontend (volumes pgdata, mediadata)
```

## Key conventions (must follow)
- **Tabs** for indentation (never spaces).
- **Single quotes** for strings; semicolons required.
- Every file starts with `@file` + `@brief`; every function needs a TSDoc block
  (`@brief`, `@param`, `@return`).
- Feature modules stay **under 400 lines**, functions **under 50 lines**.
- Avoid nested conditionals deeper than 3 levels; prefer guard clauses.
- No business logic inside Svelte components or route pages (theme toggle is
  presentation state and lives in `lib/theme.ts`).
- API boundary rule: Zod validates every input; services own the rules; the
  router stays thin; repositories own the SQL (never raw SQL in services).
- Draft/archived posts must never leak: unpublished slugs return the same 404.
- Never render unsanitized Markdown HTML.
- All comments, docs, and commit messages in **English**.
- Commits follow **Conventional Commits** (`feat:`, `fix:`, etc.).
- Do **not** add AI-slop comments like `// increment counter` above `i++`.
- Locked dependency versions, no `latest`/`^` ranges in `package.json`.
- SvelteKit 3 specifics: config lives in `vite.config.ts` via `sveltekit()`
  (no `svelte.config.js`); `tsconfig.json` extends `$app/tsconfig`; use relative
  imports (no `kit.alias`); `Handle` comes from `@sveltejs/kit/hooks`;
  `process.env` in server-only modules (no `$env` dependency).
- Media rule: services and routes depend on the `StorageProvider` interface only;
  the local backend is swappable without touching callers.

## Theme system
- `frontend/src/lib/theme.ts` — three themes: `'light' | 'dark' | 'oled'`.
- Persisted in localStorage key `site-theme`; applied via `data-theme` attribute.
- Pre-paint script in `frontend/src/app.html` removes first-paint flash.
- Design tokens live in `frontend/src/app.css` (`--bg`, `--sheet-bg`, `--card-bg`,
  `--grid`, `--ink`, `--muted`, `--border`, `--border-light`, `--accent`).
- Page recipe: `.wrapper` sheet, `.doc-meta-bar` + `.theme-picker`, `.doc-header`,
  `.record` cards with `.stamp` badges, `.spec-table` / `.inventory-table`.

## Testing
- `vitest` framework; `tests/` mirror `src/` in both packages.
- Services test against in-memory repos — no live PostgreSQL required for unit tests.
- Always run typecheck (`pnpm check` / api `tsc --noEmit`) + `pnpm test` before committing.
- Run single file: `pnpm --filter blog-api exec vitest run tests/password.test.ts`.

## Database
- PostgreSQL only; Drizzle ORM; migrations generated with
  `pnpm --filter blog-api exec drizzle-kit generate` (offline-safe).
- IDs are application-generated UUIDs (`crypto.randomUUID()`), no DB extensions.
- Import upserts by `slug`, never duplicates; per-file errors, non-zero exit.
