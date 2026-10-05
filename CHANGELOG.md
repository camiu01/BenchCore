# Changelog

Changes follow [Conventional Commits](https://www.conventionalcommits.org/).
Version 0.6.0-beta.1 is prepared locally. No tag, hosted release or deployment is created.

## Unreleased

- Preserve the installed pnpm store explicitly in the credential-free Vercel
  packaging test so CI environment isolation does not break offline installs.

- Prevent Vercel's API builder from selecting standalone `dist/index.js` instead
  of the Fetch entrypoint. Bundle a self-contained ESM API and verify production
  packaging without cloud credentials.

- Configure root Vercel Services for independently built `api` and `frontend`,
  same-origin API/health routing and runtime-only frontend-to-API binding.

- Support the complete app and secured API on Vercel Node.js 24 Functions,
  retaining persistent Node delivery and temporarily disabling the scheduler.
- Add private Cloudflare R2 with owner-bound direct upload tickets, exact-size
  signed PUTs, immutable publication and short-lived signed read redirects.
- Add offline R2, transport and browser-upload regressions and a deployment guide.

- Keep legacy pnpm deployment within an isolated metadata-only workspace
  under writable artifact staging to avoid Linux `/home/tmp` EACCES.
- Remove Dockerfiles, Compose, Docker commands and container deployment guides;
  keep the unified Node artifact and isolated PostgreSQL CI services.

## 0.6.0-beta.1 — 2026-10-02

- Name the project BenchCore: Bench-testing, Embedded Networks, & Circuit Hacks:
  Centralized Open-source Research Engine; update interface, feeds, packages and artifacts.
- Remove the development milestone ledger from the public homepage.
- Version artifact names by workflow run/attempt and expose a direct download link.

- One public Node listener for SvelteKit and `/api/*`, with an authenticated
  loopback SSR bridge retaining each visitor's rate-limit identity.
- Explicit HTTPS/origin configuration, trusted immediate proxy IPs, readiness
  and liveness probes, and bounded graceful shutdown.
- Public reader-only registration and password changes requiring the old password.
- Administrator user listing/creation, role changes, disabling and reactivation.
- Atomic session revocation and protection of the last active administrator.
- Case-folded unique emails and a backward-compatible account/session migration.
- Compiled migration, account provisioning and operator password-recovery CLIs.
- GitHub CI with isolated PostgreSQL integration checks; CD delivering an
  allowlisted production Node archive and checksum, without GHCR/images.
- Tag-gated beta prereleases and a single-origin hosting/recovery runbook.
- Remove obsolete frontend database placeholder commands and improve empty admin state.

## 0.5.0 — 2026-10-02

### Features

- Exact-origin CSRF protection, bounded per-client rate limits and security headers.
- Strict frontend CSP and documented no-telemetry policy.
- Scheduled draft publication with a nullable `publish_at` field and retrying job.
- Revision schema groundwork, without revision browsing or restore UI.
- PostgreSQL full-text search and a public search form.
- PostgreSQL blob media storage behind the existing `StorageProvider` interface.
- CI validation on pushes and pull requests.
- Default frontend/API ports 5180/5181 to keep 3000/3001 available for other apps.
- Database-free local content preview.
- Optional unique usernames for admin login and environment-only preview bootstrap.
- Private-stdin administrator provisioning without persistent admin environment fields.
- Contributor, security, authoring, API, architecture and deployment documentation.

### Fixes

- Correct repository contract syntax and implementation mismatches.
- Prevent draft-only tags from leaking through the public tag index.
- Restrict administrative routes and mutations to administrator sessions.
- Send oversized-body errors without prematurely destroying the HTTP socket.
- Ignore malformed cookie escapes instead of failing requests.
- Route uploaded media through a dedicated same-origin frontend endpoint.
- Ship frontend runtime dependencies in its Docker image.
- Align adapter-node's request-body cap with supported media uploads.
- Improve light/dark/OLED contrast and narrow-screen layouts.
- Preserve the configured HTTP/HTTPS origin at runtime so production admin forms
  work without trusting client-supplied proxy headers.
- Validate API identifiers before issuing PostgreSQL UUID queries.
- Normalize Windows CRLF frontmatter and resolve imported forward wikilinks.

## 0.1.0 — Initial platform

Source: `bb9ff0c` (`feat: initial commit personal publishing platform`).

- pnpm monorepo with SvelteKit frontend and standalone Node HTTP API.
- TOML-frontmatter Markdown pipeline, sanitized rendering and wikilinks.
- PostgreSQL repositories, import scripts, session authentication and local media.
- Public pages, feeds, SEO, three themes, admin editor and Docker stack.

The initial commit contains the work described as milestones 0.2–0.4 in
`TODO.md`; these were not separately versioned releases.
