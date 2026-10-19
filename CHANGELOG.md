# Changelog

Changes follow [Conventional Commits](https://www.conventionalcommits.org/).
Version 0.8.0 is prepared locally. No tag, hosted release or deployment is created.

## Unreleased — 0.9.0 in progress

### Runtime and regression checks

- Validate bounded PostgreSQL pool settings for Node and Vercel, with explicit
  session/transaction modes and shared concurrent serverless readiness probes.
- Add local Node HTTP/Fetch API parity tests and a Chromium CI matrix with
  disposable memory repositories. Both browser modes use the Node frontend;
  hosted Vercel routing, scaling and cold starts remain unverified.

### Accessibility, navigation and editing

- Audit reader/admin page templates in light, dark and OLED themes with axe,
  keyboard skip-link and narrow-viewport checks. Improve control contrast,
  forced-colors styles, page titles and cookie-table keyboard scrolling.
- Improve skip-link visibility, cookie-notice placement, login form behavior,
  cover-image layout and browser theme-color updates.
- Preserve graph search, selection and neighborhood state in shareable URLs.
  Add accessible editor wikilink suggestion relationships.
- Keep unsaved editor fields when body changes trigger reactive updates.

### Discovery and release status

- Validate RSS/sitemap XML and safe Unicode, use current sitemap modification
  dates, and test SSR Open Graph/Twitter metadata and paginated tag canonicals.
- Record verified local results and remaining release gates in
  `docs/RELEASE_0.9.0.md`. No version bump, migration or release is included.
  Backup/restore tooling and manual/hosted checks remain pending.

## 0.8.0 — 2026-10-12

### Engagement and moderation

- Add independent, bounded per-IP and per-session comment submission quotas with
  `Retry-After`, plus a first-party honeypot. Legitimate comments remain pending
  until approved in the existing paginated `/admin/comments` queue.
- Record moderation and deletion events without storing comment bodies.

### Authentication and security history

- Add authenticated global logout with atomic session-epoch advancement and
  session deletion. Password changes and operator rotation also invalidate
  outstanding recovery tokens.
- Add password-confirmed administrator TOTP setup at `/account/security`.
  Verify six-digit RFC 6238 codes with bounded clock skew and an atomic replay
  watermark. Encrypt factor secrets with an operator-configured AES-GCM key.
  Activation/removal revoke sessions; password recovery does not remove 2FA.
- Add a locally generated, theme-independent authenticator QR next to the
  manual setup key. Validate its otpauth payload against the enrollment secret;
  no external image service receives factor material.
- Preserve the literal six-digit HTML pattern in enrollment, removal and login
  so Svelte does not interpolate the regex quantifier.
- Add explicit, audited offline factor recovery through private stdin.
- Persist transactional audit records for account creation/changes, password
  rotation, global logout, factor changes and selected post deletion.
- Add `/admin/audit` and typed-confirmation bulk deletion of up to 100 selected
  posts. Logs contain identifiers and counts, never credentials or post content.
- Add the offline-generated `0007_faithful_darkhawk.sql` migration and align
  workspace metadata at 0.8.0. No live migration or publication runs automatically.

### Interface language

- Add an English and Italian interface. The language comes from the `lang`
  cookie (one year, first party, HttpOnly), otherwise from the browser's
  `Accept-Language`, otherwise English. The picker works without JavaScript and
  returns only to same-site paths. `<html lang>` and dates follow the language.
- Localize API messages (`message` fields) from the same cookie or header. Error
  `code` values stay stable, and Zod `issues` stay English diagnostics.
- Show the new cookie in the cookie notice and on `/cookies`.

### Design and speed

- Restyle the site as paper-and-engineering neo-brutalism with hard offset
  shadows, square controls and filled active states. Improve the archive filter
  panel, breadcrumbs and card actions.
- Separate post selection from ledger actions, give titles their own flexible
  column and wrap long metadata and the translated bulk-delete button on mobile.
- Cut public page latency: batched author lookups, a targeted backlink query,
  parallel list and count queries, and a 15-second guest-only API read cache.
- Add a non-blocking cookie notice and a `/cookies` page.
- Center breadcrumb separators without shrinking touch targets.
- Preserve the existing interface animations and reduced-motion support.

### Public pages and discovery

- Add a localized root error page with a real HTTP 404, archive search and
  recovery links. Other errors show safe text without upstream diagnostics.
- Add `/about`, `/help` and `/privacy`, with shared footer navigation.
- Extend the existing sitemap with public information pages and the graph.
  Exclude accounts, recovery and API routes from crawler directions and add
  RSS autodiscovery.
- Mark failed responses and password-recovery pages noindex and no-store.
  Document the existing `like_voter` cookie alongside login and preferences.

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
