<!-- @file TODO.md -->
<!-- @brief Versioned development roadmap in Haguruma README style. -->

# TODO

**Bench-testing, Embedded Networks, & Circuit Hacks: Centralized Open-source Research Engine**

A self-hosted research publishing platform with a SvelteKit frontend and a
standalone TypeScript API. Markdown with TOML frontmatter is the authoring
format, PostgreSQL is the runtime source of truth, and the frontend renders
API data only.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-24-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.15.0-yellow.svg)](https://pnpm.io/)
[![Vitest](https://img.shields.io/badge/Vitest-5.0.3-green.svg)](https://vitest.dev/)

## What's new in 0.7.0

Stable release of the v0.7.0 milestone: knowledge navigation and media refinement.

- **Link previews:** hover or focus a wikilink or graph node for a lightweight
  session-aware preview. Unpublished records stay masked, reader-only bodies
  stay redacted, and no persistent client preview cache is created.
- **Fuzzy suggestions:** accent-insensitive editor completion across slugs,
  titles and tags, without new dependencies.
- **Reader navigation:** collapsible heading index from sanitized Markdown
  headings with stable anchors, fitted graph views and focused neighborhoods.
- **Archive filters:** combine up to 20 tags with AND/OR, sort by publication,
  last update or existing likes, and preserve filters across pages. Protected
  engagement counts and rank stay hidden from guests.
- **Media lifecycle:** dry-run-first orphan cleanup CLI with bounded batches
  and saved-reference rechecks, strict 5 MiB direct-upload limits with exact
  signed length/type and owner-bound completion, immediate local previews with
  measured progress and reordering, and audience-safe cache controls.
- **Delivery gates:** stable workspace metadata with exact-tag validation and
  separate stable/beta approval environments. Packaging and publication remain
  separate operator actions.

Local verification and remaining hosting gates are recorded in
[release preparation](docs/RELEASE_0.7.0.md).

## Previously in 0.6.0

**Media management.** The orphan cleanup CLI defaults to dry-run with bounded
batches and saved-use rechecks; apply mode needs stopped writers and an
explicit maintenance acknowledgement. Direct uploads keep the allowlisted MIME
set and the 5 MiB cap with exact signed length/type and owner-bound completion.

**Graph navigation.** Published posts connect through shared tags with
linear-size hub links for large topic groups, plus topic shortcuts, readable
graph labels, related-post lists and direct reading links.

**Reader UX.** Shared typography, navigation, topic cards, touch targets,
keyboard focus and recovery messages were refined; reader and admin pages hold
at the tested narrow viewport with no horizontal overflow.

**Admin safety.** Title/slug/status filters, explicit delete confirmation,
image link copy controls with clipboard feedback and a selectable manual
fallback, and server-side pagination with status counts.

**Vercel and private R2.** Full app and API on Node 24 Vercel Functions with
no listeners or startup migrations, browser-direct R2 uploads via signed
length/type with owner-bound tickets and immutable conditional publication,
and scheduling temporarily disabled on that target.

**Online beta.** One public Node service for frontend and `/api/*` on 5180,
private loopback SSR bridge, reader-only registration, admin user management
with last-active-admin protection, own-password changes with global revocation,
and tag-matched environment-gated prerelease delivery.

The full milestone history lives below under Done.

## Done

### Bootstrap — monorepo, themes and health (shipped)

- **Monorepo scaffold** — `frontend/` (SvelteKit 3, strict TS) + `api/`
  (standalone `node:http` service) + `content/posts/` authoring folder with a
  pnpm workspace. #infra #dx
- **SvelteKit 3 config** — `sveltekit()` plugin in `frontend/vite.config.ts`,
  `tsconfig.json` extends `$app/tsconfig`, relative imports, server-only
  `process.env`, `Handle` from `@sveltejs/kit/hooks`. #infra
- **TypeScript 5.9 pin** — SvelteKit 3 tooling reads `ts.sys` APIs the TS 7
  native port breaks. #infra
- **Engineering-log design system** — monospace spec sheet, blueprint grid,
  light/dark/oled themes via `data-theme`, `.record` / `.stamp` /
  `.spec-table` / `.inventory-table` recipe. #theme #ux
- **Theme preference** — `THEMES`, `isTheme()`, `getStoredTheme()`,
  `applyTheme()` with SSR guards plus `tests/theme.test.ts`, and a pre-paint
  script in `app.html` with no flash of the default theme. #theme #tests #perf
- **API health probe** — `GET /health` with JSON 404/405 handling and
  `parsePort()` env parsing. #api #tests
- **Root DX** — workspace scripts (`dev:frontend`, `dev:api`, `test`,
  `check`, `lint`, `build`) and `.env.example` files for both packages. #dx
- **House style** — `TODO.md` + `AGENTS.md` + AGPL-3.0-or-later `LICENSE`,
  `@file` / `@brief` headers, TSDoc on functions, tabs, single quotes,
  semicolons, `tests/` mirroring `src/`. #docs #style

### v0.2.0 milestone — Content pipeline & auth core (shipped)

- **Frontmatter extractor** — `api/src/markdown/frontmatter.ts` with `+++`
  fences and structured `{ file, kind, message }` errors. #content
- **Frontmatter schema** — Zod title, slug, description, status, tags,
  `published_at` and optional `cover_image`. #content
- **Markdown render** — `marked` + `sanitize-html` allowlist, excerpts,
  reading minutes and relative-image prefixing. #content #security
- **Wikilinks** — Obsidian-style `[[slug]]` / `[[slug|label]]` with
  broken-link marks plus a backlink scan in the post service. #content #ux
- **Password hashing** — scrypt envelope with `timingSafeEqual` verify and
  tests. #auth #security #tests
- **Sessions** — 32-byte token, SHA-256 hash at rest, 30-day expiry, HttpOnly
  `SameSite=Lax` cookie helpers and tests. #auth #security #tests

### v0.3.0 milestone — Database, API & media (shipped)

- **Drizzle schema** — `users`, `posts`, `tags`, `post_tags`, `sessions`,
  `post_status` enum, slug uniques and a `(status, published_at)` index;
  app-generated UUIDs with no DB extensions. #db
- **Migrations** — SQL via `drizzle-kit generate`
  (`api/drizzle/0000_parched_dormammu.sql`). #db
- **Repositories** — interfaces plus Drizzle and in-memory implementations;
  services test with zero live DB. #db #tests
- **Publishing rules** — `isPublic()`, `canTransition()`, slug
  normalization and auto-stamped `publishedAt` on publish, with unit tests.
  #posts #tests
- **Post service** — paginated published list, masked detail with backlinks
  and guarded create/update/delete. #posts
- **Import service** — file-to-pipeline upsert by slug with a per-file error
  report, plus `content:import`, `db:migrate` and `seed` scripts. #content #dx
- **Auth endpoints** — `POST /api/auth/login`, `POST /api/auth/logout` and
  `GET /api/auth/me` with Zod boundary validation. #api #auth
- **Posts endpoints** — `GET /api/posts` (paginated, published-only),
  `GET /api/posts/:slug` (404 masks drafts), `GET /api/tags`,
  session-guarded `GET /api/admin/posts*`, `POST` / `PUT` / `DELETE`
  `/api/posts` and `POST /api/render` preview. #api #posts
- **Media endpoints** — `StorageProvider` seam with a local-filesystem
  backend: `POST /api/media` (JSON base64, auth, 5 MiB cap, type allowlist),
  `GET /api/media/:key` and `DELETE /api/media/:key`. #api #media
- **Router hardening** — JSON body caps, cookie parsing and JSON 404/405/500
  shapes with a 42-test router and service suite. #api #security #tests

### v0.4.0 milestone — Public site and admin (shipped)

- **Typed API client** — Zod-validated DTOs in `frontend/src/lib/api.ts`
  with graceful `null` on API downtime so pages never 500. #frontend #api
- **Public routes** — `/` recent records, `/posts` with pagination,
  `/posts/[slug]` with cover, backlinks and reading time, `/tags` and
  `/tags/[slug]` with offline stamps everywhere. #frontend #ux
- **SEO shell** — reusable `Seo` + `DocShell` / `ThemePicker` components with
  title, description, canonical, Open Graph and Twitter/X cards, plus
  `sitemap.xml`, `robots.txt` and an RSS feed tolerant to API downtime. #seo
- **Session guard** — login/logout pages with `hooks.server.ts` session
  resolve and an `/admin` guard. #frontend #auth
- **Admin editor** — Obsidian-style `PostEditor.svelte` with write and
  API-rendered read modes, status stamps, tag CSV and image upload with
  cursor insertion. #admin #ux
- **Admin screens** — `/admin` ledger, `/admin/posts/new`,
  `/admin/posts/[id]` (save, preview, delete, upload) and `/admin/tags`
  registry. #admin

### v0.5.0 milestone — Hardening & release (prepared locally)

- **API hardening** — CSRF exact-Origin checks on mutating routes, bounded
  rate limits, security headers, administrator role enforcement and
  non-cacheable private responses. #security #tests
- **Content policy** — strict nonce-backed script/style CSP with no
  unsafe-inline, contrast-safe themes, no-telemetry policy and a threat
  model. #security #docs #ux
- **Scheduled publishing** — nullable `publish_at` with atomic due-draft
  promotion and a non-overlapping minute job; migrated `revisions`
  groundwork with no automatic capture or restore UI. #posts #db #tests
- **Full-text search** — generated Postgres `tsvector` with a GIN index,
  parameterized web search and a public search form with pagination.
  #search #tests
- **Pluggable storage** — local-filesystem and PostgreSQL blob
  `StorageProvider` backends with shared validation, a same-origin media
  proxy and working 5 MiB frontend uploads. #media #data #tests
- **CI and release** — typechecks, tests, lint and recursive build on
  push/pull request; 0.5.0 prepared locally with version bumps and a
  Conventional-Commit changelog and no tag, push or hosted release. #ci #release
- **Review fixes** — repository contracts, cookie handling, tag privacy,
  duplicate tag links, Windows frontmatter/stdin, editor state, XML feeds,
  sitemap pagination and runtime dependencies. #quality #tests
- **Documentation** — contributor, security and conduct policies plus
  architecture, authoring, API, operations, testing, troubleshooting, threat
  model and review records. #docs
- **Accounts and ops** — username/email login, private-stdin user creation,
  ignored local `.env` without `ADMIN_*`, authorized migrations, persistent
  login verification, canonical-origin bootstrap and default ports
  5180/5181. #auth #ops #dx

### v0.6.0-beta.1 — Online beta preparation (shipped)

- **One origin** — public Node service for frontend and `/api/*` on 5180
  with a private loopback SSR bridge preserving visitor quotas.
  #runtime #security
- **Production posture** — HTTPS origin checks, explicitly trusted proxies,
  coalesced DB/schema readiness and bounded shutdown. #ops
- **Accounts** — public reader-only registration with admin user
  listing/creation/roles and account disabling/reactivation. #auth
- **Recovery** — own-password changes, explicit CLI recovery, atomic
  revocation of all sessions and last-active-admin protection.
  #auth #security
- **Email identity** — account/session migration with case-folded unique
  emails and an authorized fourth migration without password or content
  changes. #db
- **Delivery** — reusable GitHub CI with PostgreSQL integration checks and
  tag-matched environment-gated beta prerelease with an allowlisted Node
  archive/checksum and no GHCR. #ci #cd #release
- **Beta docs** — production-only dependency bundle, single-origin
  hosting/backup/recovery guide and documented beta limits. #docs #ops
- **Identity** — BenchCore name and expanded title across pages, Open Graph,
  RSS, packages, docs and delivery artifacts. #branding #tests

### Maintenance — Node artifacts, Vercel/R2 and graph UX (shipped)

- **Artifact staging** — isolated dependency workspace under writable
  staging avoids legacy pnpm `/home/tmp` bin-link resolution; Windows
  bundle paths are reserved before creating junctions. #cd #tests #ops
- **Docker removal** — deployment files, commands, example variables and
  guides removed; PostgreSQL integration fixtures stay in GitHub CI.
  #ops #docs
- **Vercel target** — full app and API on Node 24 Functions with no
  listeners or startup migrations, plus a deployment guide. #ops #api
- **Private R2** — browser-direct uploads with signed length/type,
  owner-bound tickets and immutable conditional publication; scheduling
  stays disabled on serverless while dates remain editable. #media #security
- **Regression cover** — transport cancellation, session isolation, upload
  and scheduled-editor suites. #tests #docs
- **Graph links** — published posts connect through shared tags with
  deduplicated wikilinks and linear-size hub links. #graph #perf #tests
- **Discovery UX** — topic shortcuts, readable graph labels, related-post
  lists and direct reading links. #graph #ux

## Milestones

| Version | Focus | Status |
|:---|---|---|
| 0.2.0 | Content pipeline and auth core | Shipped |
| 0.3.0 | Database, API and media | Shipped |
| 0.4.0 | Public site and admin | Shipped |
| 0.5.0 | Hardening and release | Prepared locally |
| 0.6.0-beta.1 | Online beta preparation | Shipped |
| 0.6.0 | Media management and storage refinement | Shipped |
| 0.7.0 | Social graph, links and knowledge navigation | Shipped |
| 0.8.0 | Engagement, moderation and auth hardening | Pending |
| 0.9.0 | Stabilization, performance and deployment parity | Pending |
| 1.0.0 | Production readiness and developer experience | Pending |

### Validation anchor (0.7.0)

160 API + 135 frontend tests, workspace/runtime typechecks, lint and
production builds pass. Disposable browser tests cover admin creation,
editing, preview, deletion confirmation/cancellation and cleanup. Image link
controls pass clipboard success/denial checks with a test double. Selected
WCAG A/AA checks report no violations. Live PostgreSQL, hosted R2 and
deployment checks were not run.

## Pending

### Version 0.8.0: Engagement, moderation & auth hardening

Focus: make user interaction secure and scalable.

- [ ] Comment moderation and anti-spam. #social #security
	- [ ] Integrate per-IP/session rate limiting for comments.
	- [ ] Support anti-spam filters, such as Akismet, a honeypot or an optional configurable CAPTCHA.
	- [ ] Provide a comment approval workflow in the admin panel (`admin/comments`).
- [ ] Session and authentication hardening. #auth #security
	- [ ] Actively revoke session tokens on global logout and password changes.
	- [ ] Support two-factor authentication (2FA/TOTP) for administrator accounts.
- [ ] Security audit log: record critical system events, including user creation, bulk post deletion and password rotation, with an administrator-facing viewer. #security #admin

### Version 0.9.0: Stabilization, performance & deployment parity

Focus: prepare the release candidate, freeze breaking changes and optimize infrastructure.

- [ ] Functional parity between standalone and Vercel serverless deployments. #runtime #ops #perf
	- [ ] Standardize cold-start performance and database connection-pool management (Drizzle/PostgreSQL pooling with PgBouncer/Neon).
	- [ ] Add dedicated E2E tests in CI for both the Node runtime and Vercel edge/serverless targets.
- [ ] Accessibility and themes (A11y). #ux #theme
	- [ ] Review every reader and admin view against WCAG 2.1 AA.
	- [ ] Complete high-contrast light and dark theme tokens.
- [ ] SEO and dynamic metadata. #seo #tests
	- [ ] Generate dynamic Open Graph and Twitter Cards through SSR for every post and tag.
	- [ ] Automatically validate `rss.xml` and `sitemap.xml`.
- [ ] Backup and restore CLI tools: export/import the complete database and image archive in a portable format, such as a ZIP bundle or JSON + Markdown archive. #ops #data #dx

### Version 1.0.0: Production readiness, documentation & developer experience

Focus: guarantee stability, freeze API v1 and prepare for enterprise deployment.

- [ ] Public API freeze (API v1): formalize OpenAPI/Swagger specifications for every endpoint exposed under `/api`. #api #docs
- [ ] Migration guide and official documentation. #docs #ops
	- [ ] Consolidate the guides in `docs/`, including `ARCHITECTURE.md`, `DEVELOPMENT.md` and `OPERATIONS.md`.
	- [ ] Write a start-to-finish self-hosted deployment guide using Docker/Docker Compose.
- [ ] First-run onboarding wizard: provide an interactive browser setup at initial boot to create the primary administrator and configure S3/R2 storage. #auth #media #dx
- [ ] Test coverage target: exceed 85% coverage for backend unit tests (`api/tests`) and critical frontend components. #tests #quality
- [ ] Telemetry and detailed health checks: enrich `/health` with database latency, R2 availability and memory usage metrics. #api #ops

### Deferred (do not implement yet)

- [ ] Categories #taxonomy
- [ ] Analytics #data
- [ ] Newsletters #data
- [ ] Multiple authors UI (schema already supports `author_id`) #auth
- [ ] Public API tokens #api

## Run it

Prerequisites: Node.js 24, pnpm 10.15.0 and PostgreSQL 17.

```sh
git clone https://github.com/camiu01/BenchCore.git
cd BenchCore
pnpm install --frozen-lockfile
```

Checks:

```sh
pnpm check
pnpm test
pnpm lint
pnpm build
```

`pnpm test` runs the recursive Vitest suites; `pnpm check` runs the
workspace typechecks including the runtime.

## Structure

```text
content/posts/              # authoring source (*.md + +++ TOML frontmatter)
frontend/
  src/lib/                  # API client, site helpers, components, theme state
  src/routes/               # public pages, login/logout, admin, feeds
  tests/                    # Vitest suites mirroring src/
api/
  src/auth/                 # scrypt passwords and token sessions
  src/db/                   # contracts, schema, Drizzle, memory repos
  src/markdown/             # frontmatter validation and safe rendering
  src/posts/                # publishing, CRUD, import
  src/media/                # StorageProvider and backend implementations
  src/server.ts             # standalone node:http API
  tests/                    # Vitest suites mirroring src/
runtime/                    # unified production Node listener
docs/                       # architecture, authoring, API, operations guides
TODO.md                     # versioned roadmap
```

Conventions: tabs, single quotes, semicolons, TSDoc on every function, feature files <400 lines, functions <50 lines.

## License

Maintained by **Camiu** ([@camiu01](https://github.com/camiu01)). GNU Affero General Public License v3.0 (AGPL-3.0-or-later) — see [LICENSE](LICENSE).
