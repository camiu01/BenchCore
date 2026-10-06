# Changelog

Changes follow [Conventional Commits](https://www.conventionalcommits.org/).
Version 0.7.0 is prepared locally. No tag, hosted release or deployment is created.

## Unreleased

No additional changes.

## 0.7.0 — 2026-10-06

### Knowledge navigation

- Preview linked posts by hovering or focusing wikilinks and graph nodes.
  Lightweight preview endpoints mask unpublished records and redact reader-only
  descriptions and covers. No persistent client preview cache is created.
- Rank editor suggestions with accent-insensitive fuzzy title, slug and tag matches.
- Add a collapsible heading index, automatically fitted graph views and focused
  neighborhoods.
- Combine up to 20 tags using AND/OR and preserve filters across archive pages.
  Sort by publication, last update or existing likes without new tracking.
  Restricted engagement counts and popularity rank are hidden from guests.

### Media and editing

- Add an operator-only orphan cleanup CLI, dry-run by default, with bounded
  batches and saved-reference rechecks. Applying requires stopped writers and an
  explicit maintenance acknowledgement; no cleanup runs automatically.
- Enforce the existing 5 MiB direct-upload limit, exact signed MIME/length,
  owner-bound completion and conditional publication. No image resizing or
  byte-level decoder is claimed.
- Show immediate bounded local image previews, measured upload progress and
  per-file verification/failure states. Reorder queued uploads and stand-alone
  Markdown attachments without rewriting code, captions or prose.
- Add private browser revalidation for public local/database images. Audience
  checks precede 304 responses; reader-only media and R2 URLs remain no-store.
  Shared CDN caching is disabled because saved audiences can change.
- Protect unsaved edits, add server-side admin pagination/status counts and
  enlarge image previews with metadata and quick cover selection.
- Connect shared-tag graph groups and retain keyboard/mobile targets with the
  original square monospace buttons.
- Correct `tsx watch` argument ordering and add an architecture/workflow diagram.

### Delivery

- Set all workspace versions to 0.7.0. Validate stable/beta semver and exact tag
  matches before packaging or publication.
- Keep branch builds artifact-only. Stable tags use the `stable-release`
  approval environment; beta tags retain `beta-release`.
- Ship the maintenance CLI in the allowlisted Node bundle. Existing `beta:*`
  commands remain compatible aliases.
- Support both native Windows and JavaScript pnpm launchers during packaging
  and Vercel build checks, without invoking a shell.

### Changes since 0.6.0-beta.1

- Relicense BenchCore under AGPL-3.0-or-later: replace `LICENSE` with the
  official GNU Affero text, update manifest `license` fields, expose `license`
  in `GET /health`, add the footer AGPL notice and refresh README/CONTRIBUTING.

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
