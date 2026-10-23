<!-- @file docs/ARCHITECTURE.md -->
<!-- @brief Layer responsibilities, data flow, persistence, and design decisions. -->

# Architecture

Paths are relative to the repository root unless stated otherwise.
Tests exercise service and transport behavior; they do not establish hosted
deployment parity.

## Overview

A pnpm monorepo contains two independently built applications:

- **`frontend/`** — SvelteKit server-rendered UI. Fetches typed API data;
  no database credentials, SQL, filesystem content import, or Markdown pipeline.
- **`api/`** — standalone `node:http` TypeScript service. Owns authentication,
  validation, publishing, Markdown rendering, repositories, and media storage.

```text
Author files --import CLI--+
                          v
Browser -> SvelteKit -> API services -> repository interfaces -> PostgreSQL
                          |
                          +-> Markdown renderer -> sanitized HTML
                          +-> StorageProvider -> local files / database blobs / R2
                          +-> due-publication job -> published posts
```

Direct API clients use the same validation/authentication boundary. The browser
admin normally submits SvelteKit form actions; server-only clients forward the
session cookie and trusted Origin to the API.

## Module contracts

API module paths in this table are relative to `api/src/`; frontend rows
describe responsibilities in `frontend/src/`.

| Module | Owns | Must not own |
|---|---|---|
| `markdown/` | TOML parsing, validation, safe rendering, links, reading time | SQL, authentication, page state |
| `posts/` | Visibility, lifecycle, CRUD, import use cases | HTTP responses, raw SQL |
| `db/repositories.ts` | Database-free repository interfaces | Drizzle implementation details |
| `db/drizzle.ts`, `db/drizzle-*.ts` | SQL-backed repositories and persisted queries | Page rendering or cookie policy |
| `db/memory.ts` | Deterministic test implementations | Production persistence |
| `auth/` | scrypt, random tokens, hashing, expiry, cookie helpers | UI components |
| `media/` | Storage interface and concrete backends | Editorial visibility decisions |
| HTTP boundary | Zod input validation, dispatch, status/error mapping | Duplicated business rules |
| SvelteKit routes | Server loads/actions and navigation | Direct database access |
| Components | Presentation and local interaction | Publishing rules or SQL |

`index.ts` performs production dependency wiring and starts the server; it is
not a second router. Repository contracts make service tests possible without
PostgreSQL. Storage tests should exercise shared provider behavior.

## Authoring and runtime flow

1. A Markdown file begins with a `+++` TOML block.
2. Import splits metadata/body, parses TOML, and validates fields with Zod.
3. Services enforce slug uniqueness and lifecycle rules.
4. Markdown is rendered, sanitized, and stored alongside its source.
5. Import creates or updates by **slug**, with per-file failures.
6. Public repositories/services return only eligible published posts.
7. The frontend validates API DTOs and renders them.

Admin writes use the same service layer but do not automatically write back to
`content/posts/`. Import is not transactional across the whole directory:
successful files can remain imported when other files fail.

Published detail reads render the stored Markdown through the current sanitizer
again, rather than serving only the stored HTML. This makes renderer changes
visible without a reimport. Frontend builds do not import content or initialize
the database. Cookie-less frontend reads have a bounded process-local cache
(normally 15 seconds); requests carrying cookies bypass it.

## Persistence

Core tables include users, posts, tags, post/tag associations, and sessions.
IDs are application-generated UUIDs; no UUID database extension is required.
Post slugs are unique; tag relationships use a composite key. Password hashes
and session-token hashes are stored, never plaintext session tokens.

The 0.5.0 additions include:

- `publish_at` for the separate schedule exposed as `publishAt`.
- A generated search vector using PostgreSQL's `simple` configuration and a
  GIN index. Search is a database query, not client-side filtering.
- Database media metadata/blob persistence behind `StorageProvider`.
- Revision storage groundwork. No automatic history or restore API is implied.

Migrations under `api/drizzle/` are versioned artifacts. Generate offline with
`pnpm db:generate`; applying them requires `DATABASE_URL`.

## Public visibility

A post is public only when publishing rules permit it: published status and an
effective publication date that is not in the future. Draft, archived, missing,
and not-yet-public slugs return the same public 404 shape. The same eligibility
must govern list counts, search, tags, backlinks, feeds, and sitemap data.

Scheduled publishing is distinct from displaying an old publication timestamp.
The due job periodically transitions eligible scheduled records; it is not an
external queue or a guarantee of second-level execution.

## Media boundary

`StorageProvider` exposes save, load, remove, and list. Services and HTTP routes
do not know whether bytes live on disk, in PostgreSQL, or in R2.

- Local mode requires durable storage of image files **and JSON sidecars**.
- Database mode puts blobs into database backup scope.
- Changing `MEDIA_STORAGE` is selection, not migration of existing objects.
- Managed images with saved uses exclusively in the `readers` audience require
  a reader/admin session. Public-audience uses and unreferenced uploads remain
  public by key; draft status alone does not protect attachments.
- R2 stores bytes and sidecars outside PostgreSQL. Browser uploads use signed
  staging PUTs followed by owner-bound completion; reads use signed redirects.
- The standalone API supports all three providers, but unified `pnpm start`
  validates only `local` and `database`.

## Frontend and design

Public routes live alongside account and `/admin` routes. Hooks resolve sessions,
and admin loads/actions use the server-only authenticated client.
SEO helpers build URLs from the configured canonical site URL.

SvelteKit 3 specifics: configuration in `vite.config.ts` via `sveltekit()`,
`tsconfig.json` extends `$app/tsconfig`, relative imports, `Handle` from
`@sveltejs/kit/hooks`, and server-only `process.env`.

CSS tokens implement the shared spec-sheet design. Theme preference is
presentation state in `lib/theme.ts`, not a publishing concern.

## Security and scaling limitations

Public registration creates readers only. Administrator operations enforce
the role at the API boundary. Published reader-only posts still expose titles
and organization metadata; bodies, descriptions, covers, and engagement are
redacted for guests. This is not an encrypted or owner-private vault.

`api/src/index.ts` and `api/src/serverless/app.ts` wire password recovery and
newsletter services. `runtime/server.mjs` currently wires neither, so the unified
Node runtime cannot enable those workflows through environment settings alone.
Vercel uses a runtime `API_SERVICE_URL` binding between independently built
frontend and API Node Functions and does not start a scheduler.

Exact Origin checking constrains browser mutation requests but does not replace
session authentication. Rate counters are bounded and in memory: restarting
resets them, and replicas do not share them. The scheduler is an API-process
job, not a separately managed durable worker.

PostgreSQL and media are stateful; application builds are replaceable. A health
response shows that an HTTP process answers, not necessarily that every backing
service is healthy. See [Threat model](THREAT_MODEL.md) and
[Operations](OPERATIONS.md) before scaling or exposing the stack.
