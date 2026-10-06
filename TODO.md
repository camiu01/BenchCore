<!-- @file TODO.md -->
<!-- @brief Completed work and versioned development roadmap for BenchCore. -->

# TODO

Development task management for BenchCore (research frontend + standalone API).

## Done

- [x] Monorepo scaffold: `frontend/` (SvelteKit 3, TS strict) + `api/` (standalone `node:http` TS service) + `content/posts/` authoring folder, pnpm workspace (`pnpm-workspace.yaml`) #infra #dx
- [x] SvelteKit 3 config migration: `sveltekit()` plugin in `frontend/vite.config.ts`, `tsconfig.json` extends `$app/tsconfig`, relative imports (no deprecated `kit.alias`) #infra
- [x] TypeScript 5.9 pin (SvelteKit 3 tooling reads `ts.sys` APIs the TS 7 native port breaks) #infra
- [x] Engineering-log design system (`frontend/src/app.css`): monospace spec sheet, blueprint grid, light/dark/oled themes via `data-theme`, `.record`/`.stamp`/`.spec-table`/`.inventory-table` recipe #theme #ux
- [x] Theme preference helpers (`frontend/src/lib/theme.ts`): `THEMES`, `isTheme()`, `getStoredTheme()`, `applyTheme()` with SSR guards (+ `tests/theme.test.ts`) #theme #tests
- [x] Pre-paint theme script in `frontend/src/app.html` (no flash of default theme) #theme #perf
- [x] API health probe: `GET /health` + JSON 404/405 handling, `parsePort()` env parsing (`api/src/server.ts`, `api/src/index.ts`, `tests/health.test.ts`) #api #tests
- [x] Root DX: workspace scripts (`dev:frontend`, `dev:api`, `test`, `check`, `lint`, `build`), `.env.example` for both packages #dx
- [x] House style: `TODO.md` + `AGENTS.md` + AGPL-3.0-or-later `LICENSE`, `@file`/`@brief` headers, TSDoc on functions, tabs/single quotes/semicolons, `tests/` mirroring `src/` #docs #style
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

### v0.4.0 milestone — Public site and admin (shipped)

- [x] Typed API client (`frontend/src/lib/api.ts`): Zod-validated DTOs, graceful `null` on API downtime (pages never 500) #frontend #api
- [x] Public routes: `/` recent records, `/posts` + pagination, `/posts/[slug]` with cover/backlinks/reading time, `/tags`, `/tags/[slug]`; offline stamps everywhere #frontend #ux
- [x] Reusable `Seo` + `DocShell`/`ThemePicker` components: title, description, canonical, Open Graph, Twitter/X cards #seo
- [x] `sitemap.xml`, `robots.txt`, `RSS` feed server routes (tolerant to API downtime) #seo
- [x] Login/logout pages + `hooks.server.ts` session resolve + `/admin` guard #frontend #auth
- [x] Obsidian-style admin editor (`PostEditor.svelte`): write mode, API-rendered read mode, status stamps, tag CSV, image upload with cursor insertion #admin #ux
- [x] `/admin` ledger, `/admin/posts/new`, `/admin/posts/[id]` (save/preview/delete/upload), `/admin/tags` registry #admin

### v0.5.0 milestone — Hardening & release (prepared locally)

- [x] CSRF exact Origin checks on mutating API routes, bounded rate limits, security headers; administrator role enforcement and non-cacheable private responses #security #tests
- [x] Strict nonce-backed script/style CSP (no unsafe-inline), contrast-safe themes, no-telemetry policy and threat model #security #docs #ux
- [x] Scheduled publishing: nullable `publish_at`, atomic due-draft promotion, non-overlapping minute job; migrated `revisions` groundwork (no automatic capture/restore UI) #posts #db #tests
- [x] Full-text search: generated Postgres `tsvector`, GIN index, parameterized web search, public search form and pagination #search #tests
- [x] Pluggable data storage: local-filesystem and PostgreSQL blob StorageProvider backends; shared validation, same-origin media proxy and working 5 MiB frontend uploads #media #data #tests
- [x] CI: both package typechecks, tests, frontend lint and recursive build on push/pull request #ci
- [x] Release 0.5.0 prepared locally: package version bumps and Conventional-Commit-based changelog; no tag, push or hosted release created #release
- [x] Whole-project review fixes: repository contracts, cookie handling, tag privacy, duplicate tag links, Windows frontmatter/stdin, editor state, XML feeds, sitemap pagination and runtime dependencies #quality #tests
- [x] Haguruma-style documentation: contributor/security/conduct policies, architecture, authoring, API, operations, testing, troubleshooting, threat model and review record #docs
- [x] Username/email login, private-stdin database user creation, ignored local `.env` without `ADMIN_*`; authorized PostgreSQL migrations and persistent-account login verified #auth #ops
- [x] Runtime canonical-origin bootstrap and default frontend/API ports 5180/5181, leaving 3000/3001 for other applications #ops #dx

Validation: 85 API + 41 frontend tests passed; both typechecks, frontend lint/format
and both builds passed. Three migrations verified in embedded PostgreSQL and
applied to the authorized configured PostgreSQL. Production browser checks cover
login, preview, search, themes, private headers and full-size uploads.
A backup/restore drill was not run locally.

### v0.6.0-beta.1 — Online beta preparation

- [x] One public Node service for frontend and `/api/*` on 5180; private loopback SSR bridge preserves visitor quotas #runtime #security
- [x] HTTPS origin checks, explicitly trusted proxies, coalesced DB/schema readiness and bounded shutdown #ops
- [x] Public reader-only registration, admin user listing/creation/roles and account disabling/reactivation #auth
- [x] Own-password changes and explicit CLI recovery, atomic revocation of all sessions, last-active-admin protection #auth #security
- [x] Account/session migration and case-folded unique emails; authorized fourth migration applied without password/content changes #db
- [x] Reusable GitHub CI with PostgreSQL integration checks; CD delivers an allowlisted Node archive/checksum without GHCR #ci #cd
- [x] Tag-matched, environment-gated beta prerelease workflow; no tag or hosted release created locally #release
- [x] Production-only dependency bundle, single-origin hosting/backup/recovery guide and documented beta limits #docs #ops
- [x] BenchCore identity and expanded project title across pages, Open Graph, RSS, packages, documentation and delivery artifacts #branding #tests
- [x] Remove the development milestone ledger from the homepage; version CD artifact names by run/attempt with a download link #ux #cd

Validation: 95 API + 54 frontend tests, typechecks (including runtime/scripts),
lint, formatting, builds and source-size checks pass. All four migrations pass
embedded PostgreSQL checks. Source and packaged beta smoke tests pass with real
SQL repositories over the PGlite wire protocol, including reader isolation,
disable/reactivate and the browser password action/session revocation.
The configured PostgreSQL accepted the fourth migration; the unified preview
is active on 5180 and the owned split API listener on 5181 was stopped.
Registration passes selected automated accessibility checks and a 390px viewport
has no horizontal overflow. Native PostgreSQL 17 concurrency and Linux artifact
checks are configured in GitHub but have not run remotely; public hosting,
branch/environment protection and backup/restore remain operator release gates.
The BenchCore homepage also passes selected WCAG 2 A/AA checks with zero
violations/incomplete checks, displays the expanded name and has no mobile overflow.

### Node artifact maintenance — 2026-10-05

- [x] Isolated dependency workspace under writable artifact staging avoids legacy pnpm `/home/tmp` bin-link resolution #cd #tests
- [x] Reserve Windows final bundle paths before creating junctions; keep existing artifacts intact and remove owned staging #ops #tests
- [x] Remove Docker deployment files, commands, example variables and guides; retain PostgreSQL integration fixtures in GitHub CI #ops #docs

Validation: 95 API + 60 frontend tests, workspace/runtime typechecks, lint,
formatting and isolated source/bundle SQL smoke pass. Native Linux execution
must be rechecked in GitHub CD.

### Vercel and private R2

- [x] Full application and API on Node 24 Vercel Functions, without listeners or startup migrations #ops #api
- [x] Private R2 browser-direct uploads with signed length/type, owner-bound tickets and immutable conditional publication #media #security
- [x] Disable serverless scheduling temporarily; preserve dates and allow explicit clearing for manual publication #posts
- [x] Add transport cancellation, session isolation, upload and scheduled-editor regressions plus deployment guide #tests #docs

Cloud account configuration, real R2 browser uploads and public deployment remain
operator gates. Offline signature tests and generated-function SQL smoke do not
claim configured cloud resources or a published site.

### Graph and usability maintenance: 2026-10-06

- [x] Connect published posts through shared tags; deduplicate wikilinks and use linear-size hub links for large topic groups. #graph #perf #tests
- [x] Add topic shortcuts, readable graph labels, related-post lists and direct reading links. #graph #ux
- [x] Refine shared typography, navigation, topic cards, touch targets, keyboard focus and reader recovery messages. #frontend #theme #ux
- [x] Add admin title/slug/status filters and require an explicit confirmation before post deletion. #admin #ux #tests
- [x] Add image link copy controls to existing attachments and completed uploads, with clipboard feedback and a selectable manual fallback. #media #ux #tests
- [x] Document the English roadmap from version 0.6.0 through 1.0.0 and add local STRIDE review context. #docs #security

Validation: 160 API + 135 frontend tests, workspace/runtime typechecks, lint
and production builds pass. Disposable browser tests exercise admin creation,
editing, preview, deletion confirmation/cancellation and cleanup. Image link
controls pass clipboard success/denial checks with a test double;
the temporary upload is deleted after verification. Reader and
admin pages have no horizontal overflow at the tested narrow viewport.
Selected WCAG A/AA checks report no violations; SVG label contrast was checked
from computed theme colors. Screenshots and native-pointer automation were
unreliable in this session, so browser interactions used DOM events.
Live PostgreSQL, hosted R2 and deployment checks were not run.

## Pending

### Version 0.6.0: Media management & storage refinement

Focus: optimize the file lifecycle, clean up orphaned media and refine CDN/R2 management.

- [ ] Background cleanup job for orphaned media: implement a periodic task or dedicated CLI command (`api/src/cli/media.ts`) that uses `deletion-service.ts` to delete R2 files no longer referenced by Markdown posts. #media #storage #ops
- [ ] Automatic image validation and resizing: add server-side compression (WebP/AVIF) or enforce strict payload limits for direct uploads (`direct-upload.ts`). #media #security #perf
- [ ] Improve the PostImages UI: add immediate previews, granular upload status with percentage progress bars and visual attachment reordering. #media #ux
- [ ] CDN cache-control support: refine HTTP `Cache-Control` headers for public and private media endpoints to maximize safe edge caching. #media #security #perf

### Version 0.7.0: Social graph, bidirectional links & knowledge navigation

Focus: strengthen the wiki/knowledge-base experience and connections between posts.

- [ ] Advanced backlinks and link graph: extend `graph-service.ts` and `GraphView.svelte` with hover-card previews for posts connected through `[[wikilink]]` references. #content #graph #ux
- [ ] Intelligent wikilink suggestions: improve autocomplete in `PostEditor.svelte` with fuzzy search (for example, Fuse.js or SQLite/PostgreSQL full-text search) across slugs, titles and tags. #content #search #ux
- [ ] Hierarchical navigation and table of contents: automatically generate a table of contents (TOC) from Markdown headings in the reader frontend. #content #frontend #ux
- [ ] Advanced post filtering: support combined multi-tag filters (AND/OR) and sorting by last update or popularity in post lists. #posts #search #ux

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

- [ ] Comments #social
- [ ] Likes #social
- [ ] Categories #taxonomy
- [ ] Analytics #data
- [ ] Newsletters #data
- [ ] Multiple authors UI (schema already supports `author_id`) #auth
- [ ] Public API tokens #api
