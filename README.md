<!-- @file README.md -->
<!-- @brief Purpose, setup, workflows, configuration, and operational boundaries. -->

# BenchCore

BenchCore is a self-hosted website for writing and sharing engineering notes.
It is for authors who want Markdown editing, linked notes, searchable archives,
and a public reading interface, with optional posts restricted to signed-in readers.

The application combines a SvelteKit frontend, a TypeScript HTTP API, and PostgreSQL.
Administrators manage content and accounts; readers browse and access reader-only posts.
It is not a bench-testing tool, an encrypted vault, or a collaborative editor.
Markdown files are an import source, not a live, two-way copy of database content.

[![License: AGPL-3.0-or-later](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue)](LICENSE)

[Features](#what-it-does) · [Requirements](#requirements) · [Setup](#build-and-run) · [Use](#controls-and-everyday-use) · [Configuration](#configuration) · [Architecture](#architecture) · [Troubleshooting](#limitations-and-troubleshooting) · [Development](#development)

## What it does

### Available in the source

Implemented capabilities do not establish production readiness. Workspace packages
are versioned **0.8.0**; stabilization work for 0.9.0 is still in progress.

| Feature | Observable behavior |
| --- | --- |
| Public reading | Browse posts, tags, categories, related notes, RSS, and a graph of published notes. |
| Search and filters | Combine full-text search, category, and up to 20 tags with AND/OR; sort by publication, update time, or likes. |
| Reader accounts | Register as a reader, sign in by username or email, read restricted posts, change passwords, and revoke device sessions. |
| Administrator workbench | Create, edit, preview, publish, archive, and explicitly delete posts; manage accounts, tags, categories, comments, and security history. |
| Markdown | Render sanitized Markdown, tables, code, math, wikilinks, backlinks, heading navigation, and reading-time estimates. |
| Imports | Upsert Markdown/TOML files by slug, or create notes from selected Markdown files and Obsidian ZIPs with an explicit visibility choice. |
| Publication states | Drafts and archived posts stay out of public routes. Reader-only published posts expose titles but withhold protected content from guests. |
| Scheduled publication | A persistent API-process job promotes due drafts approximately once per minute unless disabled. |
| Managed images | Administrators upload PNG, JPEG, WebP, or GIF images up to 5 MiB and use their URLs in posts and covers. |
| Engagement | Like eligible posts and submit comments; comments require administrator approval before public display. |
| Account protection | Opaque cookie sessions, global logout, and optional administrator TOTP enrollment with an operator-supplied encryption key. |
| Presentation | Choose light, dark, or OLED themes and Italian or English interface text. |

### Experimental and incompletely validated

| Feature | Observable behavior |
| --- | --- |
| Vercel deployment | Configured frontend/API Node Functions use a private service binding and private R2 uploads. Hosted routing, pooling, and performance remain operator checks; scheduling is disabled. |
| Email workflows | Standalone API and Vercel entrypoints support Zoho EU password recovery and an explicitly enabled, double-opt-in newsletter. Sends are manual batches of at most five recipients, not publish notifications. Real SMTP validation remains pending. |
| Unified Node email support | `pnpm start` does not currently wire password recovery or newsletter dependencies. Environment variables alone cannot enable these workflows on this entrypoint. |

### Planned or deferred

The [roadmap](TODO.md) tracks hosted deployment parity, manual accessibility review,
and portable backup/restore CLI tooling. Revision tables exist, but automatic
history, diffs, and restoration are not implemented. API v1 stabilization is future
work, not a compatibility guarantee for the current API.

## Requirements

| Use | Requirements |
| --- | --- |
| Visit a deployed site | A browser; no developer tools, database access, or service credentials. |
| Develop locally | Git, Node.js 24, pnpm 10.15.0, and PostgreSQL 17 for persistent operation. A database-free visual preview is available. |
| Self-host with Node | Node.js 24, PostgreSQL, HTTPS for public hosting, and persistent media storage. CI assembles Linux x64 archives; local bundles follow the build machine. |
| Deploy on Vercel | Configured frontend/API services on Node.js 24, external PostgreSQL, and private R2 for the documented direct-upload path. |
| Enable optional services | Zoho EU SMTP for email; an authenticator and `AUTH_TOTP_KEY` for administrator TOTP. Neither is required for public browsing or basic editing. |

GitHub Pages cannot run this backend. See [Node deployment](docs/BETA_DEPLOYMENT.md)
and [Vercel deployment](docs/VERCEL_DEPLOYMENT.md) for their different requirements.

## Build and run

Run commands from the repository root unless stated otherwise. Initialization
commands below write to your selected database; review the connection first.

### 1. Prerequisites

Install Git, Node.js **24**, pnpm **10.15.0**, and PostgreSQL **17**.
Create a local PostgreSQL database and user with permission to apply migrations.
The application does not provision PostgreSQL.

```sh
node --version
pnpm --version
```

For a disposable visual preview without PostgreSQL, use the
[database-free preview](docs/DEVELOPMENT.md#database-free-visual-preview).

### 2. Clone

```sh
git clone https://github.com/camiu01/BenchCore.git
cd BenchCore
```

### 3. Install dependencies

```sh
pnpm install --frozen-lockfile
```

### 4. Configure the environment

PowerShell:

```powershell
Copy-Item .env.example .env
```

POSIX equivalent: `cp .env.example .env`. Do not overwrite existing private settings.
Set these local values, replacing the illustrative database credential:

```dotenv
DATABASE_URL=postgresql://benchcore:replace-with-local-password@localhost:5432/benchcore
PUBLIC_API_URL=http://localhost:5181
SITE_URL=http://localhost:5173
PUBLIC_SITE_URL=http://localhost:5173
API_ALLOWED_ORIGINS=http://localhost:5173
MEDIA_STORAGE=local
BODY_SIZE_LIMIT=8M
```

For basic local use, remove the placeholder `ZOHO_SMTP_USER`,
`ZOHO_SMTP_PASSWORD`, and `PASSWORD_RESET_FROM` assignments from your private
copy unless you intend to configure SMTP. Keep `NEWSLETTER_ENABLED=false`.
There is no default administrator account.

API development and data scripts load the root `.env`; Vite loads selected
frontend settings. See the [environment reference](docs/DEVELOPMENT.md#environment)
for precedence, defaults, required settings, and server/browser boundaries.

### 5. Initialize local data

Against the new local database:

```sh
pnpm db:migrate
```

Create the first administrator using `pnpm user:create` with private JSON stdin.
The [account-provisioning example](docs/OPERATIONS.md#bootstrap-and-configuration)
prompts for a password without putting it in command arguments.

Optional: configure `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then run `pnpm seed`
to bootstrap by email and import `content/posts`. Alternatively, `pnpm content:import`
imports files without creating an account. Both imports **can overwrite database
posts with matching slugs**, including later administrator edits. Neither runs
automatically at startup.

### 6. Run locally

Terminal 1:

```sh
pnpm dev:api
```

Terminal 2:

```sh
pnpm dev:frontend
```

Open `http://localhost:5173`. The standalone API defaults to port **5181**;
it reads `PORT`, not the unused `API_PORT` entry in the example file.
Sign in through the local site to access the administrator workbench.

### 7. Build and preview

```sh
pnpm build
```

For a unified local preview, change the private `.env` site URLs to
`http://localhost:5180`, keep `MEDIA_STORAGE=local` or `database`, then run:

```sh
pnpm start
```

This serves pages and `/api/*` on port **5180** and uses real PostgreSQL.
It does not migrate, seed, or create users. Its email-wiring limitation is
listed above. Public production hosting also needs HTTPS, production settings,
persistent storage, and operator checks.

`pnpm --filter benchcore-frontend preview` previews only the frontend build;
it still needs a separately running API. It is not a full production deployment.
Use `pnpm build:vercel` only for the separately configured Vercel target.

## Controls and everyday use

| Action | Result |
| --- | --- |
| Browse posts, select tags/category, search, or change sort | The archive updates its filtered results and pagination. |
| Follow a wikilink or graph node | Open a published note; hover/focus can show a content-redacted preview when access is restricted. |
| Register, then sign in | Registration creates a reader, not an administrator, and does not automatically sign in. |
| Sign out or use global logout | Revoke the current session or all sessions respectively. Password changes also revoke all sessions. |
| Administrator: preview Markdown | Render through the API sanitizer without saving a post. |
| Administrator: save draft or archive | Persist changes in PostgreSQL, without making the post public. All administrators can manage drafts. |
| Administrator: publish with the public audience | Make the post visible when its publication date is eligible. No build or deployment is triggered. |
| Administrator: publish for readers | Guests see a title/sign-in gate; signed-in readers and administrators receive the protected content. |
| Administrator: schedule a draft | Save a separate `publishAt`; a running Node job publishes it after it becomes due. Vercel does not run this job. |
| Administrator: upload and insert an image | Store the image and add its managed URL. Uploading alone does not save or publish the post. |
| Administrator: moderate comments | Approve, reject, reopen, or delete submitted responses. |
| Administrator: import Obsidian notes | Create notes as private drafts, reader-only posts, or public posts. Existing slugs are rejected, not overwritten. |
| Subscribe to an enabled newsletter | Give explicit consent, then confirm by pressing the email-link page's button. Registration never subscribes an account. |
| Administrator: save a newsletter campaign | Save an immutable preview, not a send. Each approved `SEND` action processes at most five recipients. |

To create a draft authoring file, save this example as `content/posts/first-note.md`:

```markdown
+++
title = "First engineering note"
slug = "first-note"
status = "draft"
tags = ["engineering"]
+++

## Observation

Record the result and link to [[another-note]].
```

Use exactly three plus signs for TOML fences. File edits reach PostgreSQL only
through explicit import. Administrator saves do not update files or make Git
commits. Re-importing TOML files upserts by slug; Obsidian import is create-only.
See [Authoring](docs/AUTHORING.md), [Admin and themes](docs/ADMIN_AND_THEMES.md),
and [Newsletter and categories](docs/NEWSLETTER.md).

## Configuration

### Runtime configuration

| Option | Available configuration |
| --- | --- |
| Theme | `light`, `dark`, or `oled`; stored in browser localStorage as `site-theme`. |
| Interface language | Italian or English through the language picker. |
| Post visibility | Administrator-selected `draft`, `published`, or `archived`, plus `public` or `readers` audience. |
| Organization | Tags with editable colors and one optional main category per post. |
| Accounts and TOTP | Administrators manage reader/admin roles and activation; administrators can enroll TOTP when the server key is configured. |

### Environment and service configuration

These settings are read by server processes, not editable site settings.
Restart the relevant process after changing them.

| Option | Available configuration |
| --- | --- |
| `DATABASE_URL` | Required for persistent API/data operations; server-only PostgreSQL connection URL, no default. |
| `SITE_URL`, `PUBLIC_SITE_URL` | Trusted site origin and canonical URL; defaults vary by entrypoint. Public hosting must configure them explicitly. Read server-side, but their resulting URLs are public. |
| `PUBLIC_API_URL` | Frontend server's standalone API base, default `http://localhost:5181`; not a browser credential or browser environment export. Unified Node overrides it. |
| `API_ALLOWED_ORIGINS` | Optional exact comma-separated mutation origins for standalone API/Vercel; unified Node uses its canonical site origin instead. |
| `MEDIA_STORAGE`, `MEDIA_DIR` | Local files, PostgreSQL blobs, or private R2 in the API. Unified `pnpm start` accepts only `local` or `database`. Local API default directory is `./data/media`, relative to process working directory. |
| `AUTH_TOTP_KEY` | Optional server-only 64-hex-character encryption key. Needed for enrollment and decryption of existing factors; keep stable across replicas. |
| SMTP and newsletter settings | Optional server-only credentials and consent-token key. Disabled/unwired paths differ by entrypoint; see the full reference. |
| `API_GUEST_CACHE_MS` | Optional frontend server cache duration for cookie-less reads, normally 15000 ms, capped at 60000; `0` disables it. |

The [full environment reference](docs/DEVELOPMENT.md#environment) covers exact
names, defaults, pooling, ports, proxy trust, email, and R2 settings.
Do not infer browser safety from a variable's prefix.

### Development and build configuration

| Option | Available configuration |
| --- | --- |
| Dependencies | Exact versions in workspace manifests and `pnpm-lock.yaml`; use the frozen lockfile. |
| Frontend adapter and CSP | `frontend/vite.config.ts`; `DEPLOYMENT_TARGET=vercel` selects the Vercel build. `R2_ACCOUNT_ID` also sets the allowed upload hostname in CSP and requires rebuilding when changed. |
| File authoring | Markdown/TOML under `content/posts/`; `CONTENT_DIR` selects another import directory, not a live content watcher. |

## Architecture

Paths below are relative to the repository root.

| Module | Responsibility |
| --- | --- |
| `frontend/src/routes/` | Server-rendered public pages, account/admin actions, media proxies, RSS, sitemap, and robots routes. |
| `frontend/src/lib/` | Validated API clients, server-only session forwarding, components, themes, and localization. |
| `api/src/server.ts`, `api/src/http/` | Dispatch requests, validate inputs, enforce Origin/session checks, and map responses. |
| `api/src/posts/`, `api/src/markdown/` | Publishing, audience rules, imports, graphs, TOML parsing, sanitized rendering, and math. |
| `api/src/auth/`, `api/src/newsletter/` | Password/session/TOTP/recovery services and explicit-consent newsletter delivery. |
| `api/src/db/`, `api/drizzle/` | Repository contracts, Drizzle SQL implementations, memory test doubles, schema, and explicit migrations. |
| `api/src/media/` | Storage provider interface, local/database/R2 implementations, access checks, and maintenance. |
| `runtime/` | Unified public Node listener and private loopback API bridge. |
| `api/src/vercel.ts`, `api/src/serverless/` | Fetch-compatible Node Function entrypoint without listeners or scheduler timers. |
| `content/posts/` | Authoring files, imported deliberately rather than read by frontend requests. |
| `scripts/`, `.github/workflows/` | Packaging, isolated integration fixtures, CI, and gated release delivery. |

At request time, SvelteKit fetches API DTOs rather than SQL or authoring files.
The API reads/writes PostgreSQL through repositories. Writes render and sanitize
Markdown; post-detail reads also render stored Markdown through the current pipeline.
Preview renders without persistence.

Login issues a random HttpOnly, SameSite=Lax cookie; PostgreSQL stores its hash.
Sessions last 30 days and are checked for expiry, active account, and session version.
Administrator authorization is enforced by the API as well as frontend guards.
Mutations require an exact trusted Origin; this is a CSRF control, not authentication.

Local/database images pass through the application. R2 uploads send browser bytes
directly to signed staging URLs, followed by API completion checks; reads redirect
to short-lived signed URLs. Media access depends on saved audience references,
not simply whether a post is a draft.

Builds produce replaceable code artifacts, not a populated database. Unified Node
serves one public origin with an internal loopback listener. Vercel builds two
services with a runtime API binding. Neither deployment runs migrations at startup.
See [Architecture](docs/ARCHITECTURE.md) and the [API reference](docs/API.md).

## Limitations and troubleshooting

| Symptom / limitation | Checks and boundary |
| --- | --- |
| Startup or database-backed requests fail | Check process configuration and apply reviewed migrations explicitly. A build does not initialize the database. |
| Site reports the API offline | Check `PUBLIC_API_URL` in development or the Vercel binding. Frontend builds alone do not run the API. |
| Login does not work | Provision the intended database account; seed does not reset an existing password. Check cookie forwarding, expiry, and HTTPS for production Secure cookies. |
| Mutation returns 403 | Check exact scheme/host/port and administrator role. Do not disable Origin validation or use wildcard origins. |
| Published edit appears stale to guests | Cookie-less frontend reads can be cached for 15 seconds by default; sessions bypass this cache. |
| Reader-only content is discoverable | Titles and organization metadata can remain public. This audience restricts content, not the existence of a post. Draft privacy is separate. |
| A draft's image is accessible | Unreferenced images and images with public-audience uses are public by key. Only exclusively reader-audience saved uses require a reader/admin session. Do not upload secrets. |
| Images disappear after restart or provider change | Persist local bytes and JSON sidecars, or the selected database/R2 store. Changing providers does not migrate objects. |
| Upload fails | Check the 5 MiB image cap, allowed MIME types, adapter body limit, and, for R2, exact-origin CORS and signed-upload completion. MIME checking is not antivirus validation. |
| Scheduled post remains a draft | Keep the scheduler process running and check timezone/due date. Vercel has no scheduler; manual publication is required. |
| Newsletter/recovery unavailable on `pnpm start` | The unified runtime does not wire those dependencies. Standalone API and Vercel do; SMTP settings do not close this code gap. |
| Search or import behaves unexpectedly | Search uses PostgreSQL `simple` full-text semantics, not fuzzy matching. TOML import overwrites by slug and can partially succeed; Obsidian import does not overwrite. |
| Rate limits vary across replicas | Counters are process-local and reset on restart. They are not distributed abuse protection; configure trusted infrastructure controls. |
| Recovery after data loss | Git is not a database/media backup. There is no automatic revision restore or schema downgrade. Use an isolated restore drill before relying on a backup. |

Tests cover local service, HTTP, and UI behavior; they do not prove that a host,
bucket, SMTP account, backup, or deployment works. Deployment guides contain
operator checks, not certificates of validation.
See [Troubleshooting](docs/TROUBLESHOOTING.md), [Operations](docs/OPERATIONS.md),
and [Threat model](docs/THREAT_MODEL.md).

## Development

| Command | Check or workflow | External requirements |
| --- | --- | --- |
| `pnpm check` | API TypeScript, frontend Svelte/type checks, runtime scripts | Installed dependencies; no live services. |
| `pnpm test` | Both packages' Vitest suites | Memory repositories and local fixtures; no production credentials. |
| `pnpm lint` | Frontend ESLint | No live services. |
| `pnpm format` | Frontend formatting check, not a rewrite | No live services. |
| `pnpm build` | Production frontend/API compilation | Installed dependencies and valid build settings; no migration. |
| `pnpm build:vercel` | Target-specific compilation/packaging | Does not deploy; see the Vercel guide. |
| `pnpm test:vercel-api` | Credential-free production API packaging regression | Existing build tooling; not a hosted Vercel test. |
| `pnpm test:e2e` | Production-artifact browser journeys and accessibility checks | Built Node artifacts and installed Chromium; disposable local fixtures. |
| `pnpm test:beta`, `pnpm test:bundle` | PostgreSQL and unified runtime/bundle smoke tests | Dedicated disposable `*_test` PostgreSQL database; never production. |
| `pnpm release:check` | Workspace version/tag consistency | Local metadata only; does not publish. |

Follow [Contributing](CONTRIBUTING.md): tabs, single quotes, semicolons, documented
functions, repository-owned SQL, and service-owned rules. Run type checks and
tests before committing. Do not commit private environment files or runtime data.

| Guide | Contents |
| --- | --- |
| [Documentation index](docs/README.md) | Reading paths and current scope |
| [Development](docs/DEVELOPMENT.md) | Environment reference, setup, and preview |
| [Authoring](docs/AUTHORING.md) | Frontmatter, Markdown, imports, and scheduling |
| [API](docs/API.md) | Current routes, authentication, payloads, and errors |
| [Testing](docs/TESTING.md) | Local, browser, and isolated PostgreSQL checks |
| [Node deployment](docs/BETA_DEPLOYMENT.md) / [Vercel deployment](docs/VERCEL_DEPLOYMENT.md) | Target-specific setup and open validation gates |
| [Operations](docs/OPERATIONS.md) | Persistence, migrations, backup examples, and restore drill |
| [Security policy](SECURITY.md) | Private vulnerability reporting |

## Credits and license

Maintained by [Camiu (@camiu01)](https://github.com/camiu01).
The expanded project name is “Bench-testing, Embedded Networks, & Circuit Hacks:
Centralized Open-source Research Engine.”

Licensed under **AGPL-3.0-or-later**; see [LICENSE](LICENSE) for the actual terms.
Dependencies are listed in the workspace manifests and lockfile and retain their
own licenses and notices. No separate third-party notice file is present.
