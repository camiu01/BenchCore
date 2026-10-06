<!-- @file .factory/threat-model.md -->
<!-- @brief Repository-specific STRIDE context for local commit security reviews. -->

# BenchCore threat model

Last updated: 2026-10-06. Version: 1.0.0.

This model is a code-review aid, not an external security certification.
It supplements `docs/THREAT_MODEL.md` with the reader-only, R2 and graph boundaries.

## 1. System Overview

BenchCore is a single-operator publishing application. The Node 24/pnpm
monorepo contains a SvelteKit frontend and a standalone TypeScript HTTP API.
The API owns PostgreSQL/Drizzle persistence, Markdown sanitization, sessions
and media providers. The frontend renders Zod-validated DTOs and forwards
authenticated admin actions to the API. Production can use one Node listener
with a loopback SSR bridge, or separate frontend/API Vercel services.

Post content moves from admin forms or the trusted Markdown/TOML import CLI,
through input validation, publishing rules and sanitization, into PostgreSQL.
Public repositories filter publication status and time. Reader-only content
is redacted until a valid reader/admin session is resolved. Public graph nodes
contain published metadata and tags, never raw Markdown or protected summaries.

Media uses local files, database blobs or private R2 storage. R2 uploads use
owner-bound signed staging tickets and validated publication; browser uploads
do not pass through a Function body. Served media requires the audience checks
documented in `docs/ADMIN_AND_THEMES.md`, not merely an unguessable key.

## 2. Trust Boundaries & Security Zones

- Public: arbitrary HTTP clients, hostile Origins, paths, query strings,
  request bodies, authored Markdown and image bytes.
- Authenticated: readers may access reader-only published content; administrators
  may edit posts, users, tags and moderation state. Roles are enforced by the API.
- Internal: repository implementations, configured service bindings, trusted
  import/account CLIs, operator environment and storage credentials. Stored
  content remains untrusted when rendered.

Session tokens are random, expire and are persisted as hashes. Passwords use
scrypt. Cookies are HttpOnly with production Secure and SameSite restrictions.
Mutating API requests require an exact configured Origin. Host-derived origins,
frontend navigation and confirmation dialogs are not authorization controls.
Disabling an account and changing a password revoke its sessions.

## 3. Attack Surface Inventory

- Public posts, search, tags, graph, RSS, sitemap and `/health`: visibility
  leaks, unbounded queries, enumeration and response-size amplification.
- Login, registration, password changes and recovery: guessing, enumeration,
  role injection, token disclosure and delivery-provider misconfiguration.
- Admin post/tag/user/comment actions: CSRF, role bypass and destructive edits.
- Markdown rendering and preview: stored XSS, hostile URLs and costly rendering.
- Media upload/read/delete and R2 tickets: oversized bytes, path traversal,
  cross-owner tickets, stale references and private-media cache disclosure.
- Node/Vercel runtime and SSR transport: untrusted forwarded headers, public
  internal listeners, incorrect proxy configuration and accidental caching.
- Operator CLIs, packaging and CI: unintended imports, leaked environment
  files, secret-bearing artifacts and unsafe migrations.

## 4. Critical Assets & Data Classification

- User names/emails, comments and account state are application personal data.
  Admin access, HTTPS and operator-controlled backups protect them.
- Password hashes, session tokens, reset tokens, database/R2/SMTP credentials
  are sensitive. Never include credentials in Git, screenshots or reports.
- Drafts, archived posts and reader-only bodies/summaries/media require
  publication and audience checks on every response path.
- Published content, file references and moderation state need integrity.
  Confirmation UI reduces accidents; it does not replace API authorization.
- Database/storage availability matters to the public site. Limits must also
  cover derived work such as graph expansion, not only request bodies.

## 5. Threat Analysis

| Component | STRIDE threats and controls | Residual risk |
|---|---|---|
| Auth/accounts | Spoofing: scrypt, expiring hashed sessions and login limits. Tampering/elevation: Zod inputs and API role checks. Disclosure: private/no-store responses. | No admin MFA; process-local quotas are not distributed abuse protection. |
| Public reads/search/graph | Disclosure: publication filters, masked 404s and reader redaction. DoS: bounded inputs; large shared-tag groups use linear-size hub links. | Large archives still require capacity planning; exposed titles/tags are intentional public metadata. |
| Admin writes/moderation | Spoofing/elevation: session and administrator role required. Tampering: exact Origin and validated inputs. Repudiation: no immutable audit log is claimed. | Trusted admins can delete data; backups and restore drills remain necessary. |
| Markdown/frontend | Tampering: sanitized API HTML, escaped Svelte text, safe URL handling and strict CSP. Disclosure: server-only trusted API bindings and protected rendering. | Sanitizer/CSP regressions remain high risk; authored external resources can contact third parties. |
| Media/R2 | Spoofing/elevation: owner-bound tickets and protected mutations. Tampering: safe keys, MIME/size validation and reference-aware deletion. Disclosure: audience checks and private caching rules. | Allowed MIME is not antivirus; reused public assets and issued signed URLs have revocation limits. |
| Repositories/runtime/CLI | Tampering: parameterized repository queries, guarded operations and allowlisted packaging. Spoofing: explicit proxy trust. Disclosure: secrets stay outside deliverables. | Compromised hosts/operators/CI credentials are outside application isolation; migrations need backups. |

Severity guidance: authentication bypass, protected-content disclosure and
arbitrary execution are critical/high. Stored XSS, cross-owner media access,
SQL injection and role escalation are high. Missing private cache controls
and unbounded derived work require context-specific medium/high review.
Usability issues without an exploitable boundary crossing are not vulnerabilities.

## 6. Vulnerability Pattern Library

- SQL injection: reject interpolated user text in SQL; use Drizzle parameters
  inside repositories, never raw SQL in services or Svelte components.
- XSS: `{title}` is escaped Svelte text. `{@html contentHtml}` is acceptable
  only when the value comes from the API sanitizer; raw Markdown is not safe HTML.
- Command injection: never send request/form values to shell execution.
  Operator commands must be fixed, reviewed and scoped.
- Path traversal: reject arbitrary paths as media keys; use generated,
  validated keys and the StorageProvider interface.
- Auth bypass: frontend guards and hidden links are insufficient.
  Mutations need API session resolution, role enforcement and exact Origin checks.
- IDOR: resolve ownership for upload tickets and protected media; knowing an
  object key or UUID does not grant access.
- Prototype keys: maps/sets are preferred for user-controlled slugs and tags;
  do not use unchecked object indexing for arbitrary identifiers.
- Algorithmic DoS: avoid complete shared-tag meshes for large topic groups;
  preserve discoverability through published metadata instead of quadratic edges.

## 7. Security Testing Strategy

Run API unit/router tests and frontend rendering tests without a live database.
Keep negative tests for drafts, future publications, reader-only summaries,
session expiry/revocation, unsafe Origins and media ownership. Add graph
duplicate-edge and dense-group growth tests. Test destructive UI confirmation
without relying on it for server-side access control.

Use disposable local in-memory accounts for browser tests, not real credentials.
Production SQL, R2, backup/restore and hosted runtime checks remain separate
operator gates. Do not treat synthetic tests as proof of deployed configuration.

## 8. Assumptions and Accepted Risks

The operator and deployment configuration are trusted. The application is
not a multi-tenant SaaS, encrypted vault or distributed abuse defense.
Rate limits are process-local. Revisions are not a recovery guarantee.
Public titles/tags remain discoverable for reader-only published posts.
No telemetry SDK or immutable security audit trail is currently claimed.

## 9. Version Changelog

- 1.0.0 (2026-10-06): initial local review model covering the current reader,
  administrator, graph, R2 and deployment boundaries.
