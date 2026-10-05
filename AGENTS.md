# AGENTS.md — BenchCore

## Quick start
```bash
pnpm install
pnpm dev:frontend        # SvelteKit site on :5173
pnpm dev:api             # API service on :5181 (GET /health)
pnpm demo:api            # loopback-only in-memory preview, optional environment-only admin
pnpm test                # recursive: frontend + api vitest suites
pnpm check               # API TypeScript + frontend svelte-check
pnpm lint                # frontend eslint
pnpm build               # recursive builds
pnpm build:vercel        # independent frontend/API Vercel services, scheduler disabled
pnpm test:vercel-api     # credential-free production API packaging regression
pnpm start               # unified beta: frontend + /api on :5180
pnpm beta:package        # versioned Node bundle, no .env or authoring content
pnpm test:beta           # requires a dedicated local *_test PostgreSQL database
pnpm seed                # admin bootstrap + content import (needs DATABASE_URL)
pnpm user:create         # admin user from private JSON stdin, no ADMIN_* env needed
pnpm content:import      # import content/posts into PostgreSQL
```

## Architecture
- pnpm monorepo: `frontend/` (SvelteKit UI, zero direct DB access) + `api/`
  (standalone `node:http` TypeScript service, owns Drizzle + content pipeline).
- `runtime/server.mjs` combines both production handlers behind one public
  listener. The SSR API listener binds only to loopback on a random port.
- Root `vercel.json` deploys Vercel `frontend` and `api` services. Frontend
  Functions use the runtime-only `API_SERVICE_URL` binding; the API entrypoint
  is `api/src/vercel.ts`. Neither starts migrations or scheduler jobs.
  Its build typechecks without emitting `dist`, then creates a self-contained
  `output/index.mjs`; standalone `dist/index.js` would override the Fetch handler.
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
    routes/api/             # narrow media proxy for standalone dev; beta dispatches to API
    routes/register/        # public reader-only registration
    routes/account/         # authenticated password changes
    routes/*.xml|robots.txt # sitemap, RSS, robots server routes
  tests/                    # mirrors src/ (smoke.test.ts, theme.test.ts)
api/
  src/
    server.ts               # router: /health, /api/auth/*, /api/posts*, /api/media*
    http/                   # transport handlers, Origin guard, rate limits and headers
    index.ts                # boot only (repos + storage wiring, listen)
    db/schema.ts            # Drizzle tables: users, posts, tags, post_tags, sessions
    db/repositories.ts      # repository interfaces (DB-free contracts)
    db/drizzle.ts           # Drizzle implementations (only SQL lives here)
    db/drizzle-posts.ts     # publishing, full-text search and atomic schedule promotion
    db/drizzle-media.ts     # PostgreSQL blob persistence behind a repository contract
    db/memory.ts            # in-memory repos for tests
    db/client.ts            # lazy postgres client (DATABASE_URL)
    markdown/               # frontmatter.ts, schema.ts (Zod), render.ts (wikilinks + sanitize)
    posts/                  # publishing.ts (rules), post-service.ts, import-service.ts
                            # scheduler.ts (non-overlapping minute ticks)
    auth/                   # password.ts (scrypt), session.ts (token + cookie)
    media/                  # StorageProvider seam + local-filesystem/database backends
  scripts/                  # import.ts (content:import), migrate.ts, seed.ts (admin bootstrap)
  drizzle/                  # generated migrations (drizzle-kit, no live DB needed)
  tests/                    # mirrors src/
runtime/                    # single-origin beta settings, bridge, dispatcher and boot
scripts/                    # allowlisted packaging and guarded PostgreSQL smoke
TODO.md                     # roadmap: Done (with #tags) + Pending per milestone
docs/                       # architecture, authoring, API, testing and operations guides
CHANGELOG.md                # local release history; publishing is a separate authorized action
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
  `MEDIA_STORAGE=local|database|r2` selects the backend at boot. R2 uploads go
  directly from the browser to signed staging URLs, never through Function bodies.
- Mutating API requests require an exact trusted Origin. Configure production
  `API_ALLOWED_ORIGINS` or `SITE_URL`; never trust request-derived hosts.
- Scheduled posts remain drafts with a nullable `publishAt`; the repository job
  atomically publishes due drafts. Revision tables are groundwork only.
- Node.js 24 and pnpm 10.15.0 are the supported development/CI/runtime baseline.

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
- Run single file: `pnpm --filter benchcore-api exec vitest run tests/password.test.ts`.

## Database
- PostgreSQL only; Drizzle ORM; migrations generated with
  `pnpm --filter benchcore-api exec drizzle-kit generate` (offline-safe).
- IDs are application-generated UUIDs (`crypto.randomUUID()`), no DB extensions.
- Import upserts by `slug`, never duplicates; per-file errors, non-zero exit.
