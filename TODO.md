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

## What's new in 0.8.0

Engagement, moderation, authentication hardening and public-site completion.

- Comment submission quotas for IPs and sessions, a first-party honeypot and the
  existing administrator approval queue.
- Global device logout, password-confirmed administrator TOTP with encrypted
  secrets and replay protection, and explicit offline factor recovery.
- Identifier-only security history at `/admin/audit` and confirmed selected
  post deletion with transactional audit records.
- Workspace metadata at 0.8.0 and an offline-generated migration, applied only
  during a separately authorized local startup. Tags and hosted releases remain
  separate operator actions; deployment follows the configured CI/CD.
- Localized 404 recovery, project information, reader guide, privacy and a
  complete footer, with expanded sitemap and crawler privacy directions.

Setup, recovery and hosting gates are recorded in
[0.8.0 release preparation](docs/RELEASE_0.8.0.md).

## Previously in 0.7.0

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

### Source-level CSS customization (implemented locally)

- [x] Split the global stylesheet into focused theme, shell, records, prose,
      graph, topics, engagement, responsive and motion files. #theme #dx
- [x] Centralize shared typography, sizing, spacing, borders and shadows; add
      a final customization layer so shared component overrides need no
      specificity escalation. #theme #components
- [x] Document token and component customization in
      [CSS customization](docs/CSS_CUSTOMIZATION.md). #docs
- [x] Check customization overrides, 320/390/768/1280px layouts, theme control
      semantics and reduced motion; retain all-theme automated accessibility
      coverage. Manual accessibility review remains pending. #tests #ux

### Categories and manual opt-in newsletter (implemented, activation pending)

- Optional main post category, independent of tags, with editor assignment,
  admin rename/clear confirmation and shareable public archive filters.
  #publishing #categories
- Explicit unchecked newsletter consent, expiring single-use email confirmation,
  account-independent unsubscribe, private counts and manual preview-first
  five-recipient batches with durable claims. No automatic enrollment or sends.
  #newsletter #privacy
- Offline migration `0008` generated, not applied. Real SMTP verification and
  operator activation remain pending; see [delivery guide](docs/NEWSLETTER.md).
  #operations #pending

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

### v0.8.0 milestone: Engagement, moderation and auth hardening (prepared locally)

- [x] Comment moderation and anti-spam. #social #security
  - [x] Independent bounded per-IP/session submission quotas with `Retry-After`.
  - [x] First-party honeypot, with no external CAPTCHA or Akismet dependency.
  - [x] Existing paginated approval/rejection workflow at `/admin/comments`,
        with moderation events recorded in the security log.
- [x] Session and authentication hardening. #auth #security
  - [x] Global logout revokes all sessions atomically; password changes and
        recovery retain revocation and invalidate outstanding recovery tokens.
  - [x] Password-confirmed administrator 2FA/TOTP with encrypted secrets,
        owner-bound expiring enrollment, atomic replay protection and audited
        offline recovery.
- [x] Security audit log. #security #admin
  - [x] Transactional records for account creation/management, password
        rotation, global logout, TOTP changes and selected post deletion.
  - [x] Administrator-only paginated viewer at `/admin/audit`, without
        credentials, emails, IP addresses or content bodies.
  - [x] Explicit `DELETE` confirmation for bounded selected deletion.

Comment quotas remain process-local. Native PostgreSQL concurrency and hosted
deployment verification remain operator gates, not locally verified results.

## Milestones

| Version      | Focus                                            | Status                                           |
| :----------- | ------------------------------------------------ | ------------------------------------------------ |
| 0.2.0        | Content pipeline and auth core                   | Shipped                                          |
| 0.3.0        | Database, API and media                          | Shipped                                          |
| 0.4.0        | Public site and admin                            | Shipped                                          |
| 0.5.0        | Hardening and release                            | Prepared locally                                 |
| 0.6.0-beta.1 | Online beta preparation                          | Shipped                                          |
| 0.6.0        | Media management and storage refinement          | Shipped                                          |
| 0.7.0        | Social graph, links and knowledge navigation     | Shipped                                          |
| 0.8.0        | Engagement, moderation and auth hardening        | Prepared locally                                 |
| 0.9.0        | Stabilization, performance and deployment parity | In progress                                      |
| 1.0.0        | Production readiness and developer experience    | In progress; OpenAPI implemented, freeze pending |

### Validation anchor (0.8.0)

223 API + 198 frontend tests, workspace/runtime typechecks, lint, production
builds, release metadata and credential-free Vercel API packaging pass.
Synthetic browser checks cover selected deletion, protected audit/settings,
global logout, TOTP enrollment/activation and password-only denial. The new
views fit a 390px viewport. Selected WCAG A/AA checks report no violations;
the ledger has one contrast check requiring manual review. Changed frontend
files pass formatting; the full formatting check flags 97 unchanged files.
Native PostgreSQL, hosted R2/SMTP and deployment checks were not run.

### Validation anchor (0.9.0 work in progress)

284 API + 314 frontend unit tests pass, along with workspace/runtime typechecks
and lint. Chromium passes 96 browser checks against each local API transport:
Node HTTP and the Vercel Node handler through its Fetch adapter. The production
Node frontend is used in both fixture modes; this is not a hosted Vercel E2E
result. The suite covers 31 reader/admin route cases in all three themes at
390px, automated WCAG 2.1 A/AA rules, skip-link focus, overflow, real
login/publishing/global-logout forms, SSR social metadata and parsed XML feeds.
The publishing journey also protects against editing the body clearing other
unsaved editor fields.

Node and Vercel production builds and the credential-free real Vercel API
packaging regression pass. Pool settings and concurrent readiness behavior
have offline regression tests. Hosted cold-start/pooling, PostgreSQL, R2/SMTP,
the actual Vercel frontend and manual accessibility checks remain operator
gates. No migration, deployment, release or version bump was performed.

### Current local verification evidence

- Operator decision: leave real PostgreSQL recovery, hosted integration and
  manual accessibility checks **to be tested**. No local PostgreSQL installation
  or test cluster was created; the remaining release gates are not waived.
- Latest checks: 324 API and 315 frontend unit tests pass; the opt-in real
  PostgreSQL recovery drill is skipped. Workspace/runtime typechecks, lint,
  Node/Vercel builds, compiled backup CLI help and credential-free Vercel API
  packaging pass. New backup/shared-wiring files pass formatting; no full-repo
  formatting result is claimed.
- The prior Chromium run passes 98 accessibility/customization checks using
  the local Node API fixture, at 320/390/768/1280px. Browser checks were not
  rerun for the backend-only backup/wiring changes.
- The backup CLI preserves managed media keys, validates complete archives and
  refuses nonempty targets. Recovery requires explicit database and media
  destinations; no overwrite or automatic cleanup is offered.
- OpenAPI covers 58 operations across 46 paths, with structural/reference
  validation, exact regeneration and complete method/path inventory checks,
  plus selected real in-memory HTTP response checks. See
  [contract maintenance](docs/API_CONTRACT.md) for limits.
- This evidence does not close the hosted Vercel, PostgreSQL, R2/SMTP, manual
  accessibility or backup/recovery gates. Metadata remains 0.8.0; no 1.0.0 tag
  or hosted publication is authorized by updating this roadmap.

## Pending

### Version 0.9.0: Stabilization, performance & deployment parity

Focus: prepare the release candidate, freeze breaking changes and optimize infrastructure.

See [0.9.0 preparation and completion gates](docs/RELEASE_0.9.0.md).
Workspace metadata stays at 0.8.0 until the remaining gates are closed.

- [ ] Functional parity between standalone and Vercel serverless deployments. #runtime #ops #perf
  - [x] Bound and validate shared Drizzle/PostgreSQL pool settings, with explicit session/transaction modes for PgBouncer/Neon and small Vercel defaults.
  - [x] Keep liveness lazy and coalesce concurrent serverless readiness checks without caching stale results.
  - [x] Add a dedicated browser CI matrix for Node HTTP and the Vercel API Fetch adapter, using disposable memory fixtures.
  - [x] Share service wiring across all production entrypoints, including previously omitted unified-Node newsletter/password recovery and R2 support.
  - [ ] Measure hosted cold/warm starts and provider pooling under concurrent instances.
  - [ ] Verify the actual Vercel frontend, service bindings and hosted runtime E2E. Both services target Node.js 24, not Edge.
  - [x] Document disabled Vercel scheduling and the required trusted shared-ingress abuse boundary in [Runtime parity](docs/RUNTIME_PARITY.md).
  - [ ] Verify the documented scheduler/ingress policy on the actual staging targets before claiming full deployment parity.
- [ ] Accessibility and themes (A11y). #ux #theme
  - [x] Automatically review every reader/admin page template against selected WCAG 2.1 A/AA rules in light/dark/OLED, with keyboard skip-link and narrow-viewport checks.
  - [x] Complete tested text/active-control contrast and distinct control-boundary tokens, with system forced-colors support.
  - [x] Fix missing page titles, keyboard scrolling of the cookie table and skip-link focus order before the cookie notice.
  - [ ] Complete manual screen-reader, zoom, OS high-contrast and interactive/error-state review; automated results are not WCAG certification.
- [x] SEO and dynamic metadata. #seo #tests
  - [x] Verify dynamic Open Graph and Twitter Cards through SSR for posts and tags, including article dates, optional covers and paginated tag canonicals.
  - [x] Automatically parse and validate `rss.xml` and `sitemap.xml`, with safe XML 1.0 text and current last-modified dates.
- [ ] Backup and restore CLI tools: export/import the complete database and image archive in a portable format, such as a ZIP bundle or JSON + Markdown archive. #ops #data #dx
  - [x] Implement full native PostgreSQL/custom-dump and checksummed managed-image export, verification and empty-target-only restore with original keys.
  - [x] Add isolated integrity/overwrite/R2 protocol regressions, artifact CLI/guide packaging and [private recovery instructions](docs/BACKUP.md).
  - [ ] Run the opt-in real PostgreSQL drill against three empty loopback test databases and verify isolated application behavior. Native clients are not available on this host.

### Version 1.0.0: Production readiness, documentation & developer experience

Focus: close the 0.9.0 gates, approve API compatibility and make supported
self-hosted deployments reproducible. A completed contract is not itself a
production-readiness or API-freeze claim.

Work order: **OpenAPI baseline → compatibility review → backup/recovery →
runtime/hosting parity → onboarding and operational checks → release candidate**.
Documentation and regression tests accompany each implementation.

- [ ] Public API freeze (API v1). #api #docs #compatibility
  - [x] Generate a complete OpenAPI 3.1 baseline for the existing router,
        with cookie sessions, required Origin, roles, pagination, request/response
        shapes, errors and optional-service behavior: [OpenAPI JSON](docs/openapi.json).
  - [x] Reuse existing Zod input validators; fail tests on regeneration drift,
        missing/extra route operations, invalid references or missing mutation
        security requirements. Checks run in the existing unit-test CI job.
  - [x] Add selected HTTP wire-model regressions and
        [contract maintenance instructions](docs/API_CONTRACT.md).
  - [ ] Review and approve compatibility for every operation, including partial
        PUT updates, stable errors, null/omission semantics and UUID/slug lookups.
  - [ ] Decide and document the breaking-change/versioning policy. Do not add
        `/api/v1` or promise a freeze merely because the artifact exists.
  - [ ] Close live Node/Vercel integration gaps and add contract regressions for
        identified risks before declaring API v1 stable.
- [ ] Complete the prerequisite 0.9.0 gates. #release #ops
  - [ ] Implement the complete database/media backup and restore CLI; prove
        recovery into isolated empty state, with explicit overwrite behavior,
        safe archive/path validation and separately protected recovery secrets.
  - [ ] Record hosted persistence, R2/SMTP and concurrent-instance results;
        resolve or explicitly approve scheduling/quota differences.
  - [ ] Complete manual accessibility review; automated checks are insufficient.
- [ ] Migration guide and official documentation. #docs #ops
  - [ ] Consolidate the guides in `docs/`, including `ARCHITECTURE.md`, `DEVELOPMENT.md` and `OPERATIONS.md`.
  - [ ] Verify the supported Node 24 bundle deployment and upgrade path
        end-to-end, including migrations, rollback limits, recovery and Vercel
        differences. Docker/Compose was removed and is not a supported target;
        reintroducing it requires a separate explicit scope decision.
  - [x] Document editable CSS tokens, shared components and customization.
- [ ] First-run onboarding wizard. #auth #media #dx #security
  - [ ] Define an operator-owned one-time bootstrap credential and atomic
        first-admin claim; never expose an unauthenticated public setup race.
  - [ ] Create the primary administrator without logging secrets, protect
        storage configuration and permanently disable setup after completion.
  - [ ] Test simultaneous setup, retries/failures and already-configured
        installations; keep the existing private-stdin CLI recovery path.
- [ ] Test coverage target: measure and exceed 85% for backend unit tests and
      critical frontend code, with explicit include/exclude rules and enforceable
      thresholds. Preserve behavior-focused tests; counts are not coverage. #tests #quality
- [ ] Operational health diagnostics. #api #ops #privacy
  - [ ] Keep public liveness/readiness responses generic and credential-free.
  - [ ] Define administrator/operator-only dependency latency, storage
        availability and memory diagnostics with bounded probe costs.
  - [ ] No external telemetry or analytics without a separate scope/privacy
        decision; test unavailable dependencies and avoid leaking infrastructure.
- [ ] Release-candidate acceptance. #release #tests
  - [ ] Record final unit, contract, type, lint, format, build, browser,
        packaging, PostgreSQL and hosted-check evidence for the same candidate.
  - [ ] Close or explicitly approve every remaining gate above; publish
        known limits, support targets, upgrade and recovery instructions.
  - [ ] Align workspace versions/changelog only when ready, validate release
        metadata and prepare the artifact. Tagging, push and hosted release remain
        separately authorized actions.

### Deferred (do not implement yet)

- [ ] Analytics #data
- Categories and manual double-opt-in newsletters are implemented; real SMTP
  activation and migration/hosting checks remain operator gates, not deferred
  feature implementations. See [Newsletter](docs/NEWSLETTER.md).
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
