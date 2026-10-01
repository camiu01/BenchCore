# Personal Publishing Platform

Custom-built personal blog, designed to evolve into a full publishing platform.
Markdown + TOML is the authoring format; PostgreSQL is the runtime source of truth.
Obsidian-style `[[wikilinks]]` with backlinks, plus images via a swappable storage seam.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

Monorepo: `frontend/` (SvelteKit site) + `api/` (standalone TypeScript service).
Shared authoring folder: `content/posts/*.md`. Roadmap: `TODO.md`.

## Quick start

Local dev (needs PostgreSQL + `DATABASE_URL`):

```sh
pnpm install
pnpm db:migrate       # apply Drizzle migrations
pnpm seed             # admin bootstrap (ADMIN_EMAIL/PASSWORD) + import content/posts
pnpm dev:frontend     # site on :5173
pnpm dev:api          # API on :3001
```

Or the full stack via Docker (postgres + api + frontend on :3000):

```sh
cp .env.example .env  # adjust passwords and URLs
pnpm docker:up
```

Checks: `pnpm test`, `pnpm check`, `pnpm lint`, `pnpm build`.

## Architecture

```text
content/posts/*.md (Markdown + TOML +++)
  -> api/src/markdown/* (extract frontmatter, parse TOML, Zod validate, render, sanitize)
  -> api/src/posts/* (post service, publishing rules, import service)
  -> PostgreSQL via Drizzle (api/src/db/*)
  -> api/src/server.ts (REST: auth, posts, tags, media, render)
  -> frontend/src/routes (public pages + /admin, data from the API only)
```

Layer rules:

- `api/src/markdown/*`: pure, UI-free content processing. Independently testable.
- `api/src/db/*`: Drizzle schema + client only. No business rules.
- `api/src/posts/*`: single home for publishing rules, slug handling, import upsert.
- `api/src/auth/*`: scrypt hashing, token sessions.
- `api/src/media/*`: `StorageProvider` seam; local-filesystem backend by default.
- `frontend/src/lib/theme.ts`: presentation-only theme state (localStorage + data-theme).
- Routes only call services/the API; no SQL, no Markdown parsing, no rule duplication.
- No business logic inside Svelte components (theme toggle is presentation state).

## Design system

Engineering-log spec-sheet aesthetic: monospace, blueprint grid background, bordered
sheet with hard shadow, record cards with stamp badges, spec/inventory tables.
Three themes (`light` / `dark` / `oled`) via CSS variables on `data-theme`,
persisted in localStorage, pre-applied in `app.html` to avoid flashes.
Lives in `frontend/src/app.css` + `frontend/src/lib/theme.ts`.
Pages reuse `.record`, `.stamp`, `.spec-table`, `.inventory-table`, `.record-body`.

## Database

`users`, `posts` (slug unique, `post_status` enum, `author_id` fk, `published_at`),
`tags`, `post_tags` (composite pk), `sessions` (token hash unique).
Index on `(status, published_at)`. IDs are app-generated UUIDs, no DB extensions.
Migrations: `pnpm db:generate` (offline-safe), `pnpm db:migrate`.

## Authentication

Database sessions: random 32-byte token, SHA-256 hash stored, HttpOnly SameSite=Lax
cookie (Secure in production), 30-day expiry. Passwords with Node `scrypt` +
`timingSafeEqual`. Secrets only via environment; never exposed to the client.

## API

`GET /health`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`,
`GET /api/posts` (paginated, published-only), `GET /api/posts/:slug` (drafts mask as 404),
`GET /api/tags`, `GET /api/admin/posts*` (guarded), `POST/PUT/DELETE /api/posts`,
`POST /api/render` (editor preview), `POST/GET/DELETE /api/media/:key`.
Zod validates every input at the boundary.

## Dependencies (pinned, minimal)

Frontend: `sveltekit`, `svelte`, `vite`, `vitest`, `tailwindcss`, `svelte-check`,
`eslint`, `prettier`, `zod` (DTO validation). API: `typescript strict`, `vitest`,
`tsx` (scripts only), `drizzle-orm`, `postgres`, `zod`, `smol-toml`, `marked`,
`sanitize-html`, plain `node:http` (no web framework).

## Key decisions

1. Split `frontend/` + `api/` so the site and the service deploy and scale independently.
2. Plain `node:http` for the API: no framework needed for a handful of JSON endpoints.
3. `+++` TOML fences (not `---` YAML) to avoid ambiguity with Markdown horizontal rules.
4. No `$lib` alias: SvelteKit 3 deprecated `kit.alias`, so imports use relative paths.
5. TypeScript 5.9 (not 7): SvelteKit 3 tooling reads `ts.sys` APIs the native port breaks.
6. SvelteKit 3 config lives in `vite.config.ts` via `sveltekit()`; `svelte.config.js`
   is rejected, `tsconfig.json` extends `$app/tsconfig`, `Handle` comes from
   `@sveltejs/kit/hooks`, server code reads `process.env` (no `$env` module).
7. Import upserts by `slug`, never duplicates; invalid files reported per-file.
8. Media goes through the `StorageProvider` interface so a database/S3 backend
   can replace local files without touching callers.
9. Publishing a post without a date stamps `publishedAt` automatically.

## Milestones

Shipped: scaffolding + DX, content pipeline (TOML/Zod/Markdown/sanitize/wikilinks),
database + import CLI, session auth, public site + SEO, Obsidian-style admin editor,
media uploads, Docker stack. See `TODO.md` for the checked-off list.
Pending: hardening (CSRF, rate limits, CSP), search, revisions, CI, release 0.5.0.
