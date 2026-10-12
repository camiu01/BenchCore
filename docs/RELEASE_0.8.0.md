<!-- @file RELEASE_0.8.0.md -->
<!-- @brief Local 0.8.0 preparation, second-factor recovery and explicit deployment gates. -->

# Preparing 0.8.0

Version 0.8.0 completes the engagement, moderation and authentication milestone.
The implementation is complete. Version tags and hosted releases remain
separate operator actions; deployments follow the configured CI/CD.

## Deployment changes

Back up PostgreSQL before explicitly applying
`api/drizzle/0007_faithful_darkhawk.sql` through the normal migration command.
The migration adds `administrator_totp` and `security_events`; it does not alter
existing passwords, content or sessions. New account operations need these tables.
No application startup or local unit test applies migrations.
A subsequent, explicitly authorized local startup applied migration 0007 to
the configured database and checked readiness. This does not establish native
PostgreSQL concurrency or hosted deployment behavior.

Set `AUTH_TOTP_KEY` securely in the API environment if administrators should
enable two-factor authentication. Use an independent random 32-byte key encoded
as 64 hexadecimal characters. Do not reuse passwords, session tokens or R2 keys.
All API instances, including Vercel replicas and the unified Node service, must
use the same key. Back it up separately from PostgreSQL and keep it out of Git,
screenshots and logs.

Omitting the key disables enrollment. It never allows password-only login for
an account with an existing factor. A missing or changed key makes those
accounts unable to authenticate. Key rotation needs a separate operator-managed
re-encryption procedure; changing the variable alone is not rotation.

## Administrator two-factor authentication

1. Sign in and open **Account > Account security** (`/account/security`).
2. Enter the current password to obtain a QR and manual setup key. In Google
   Authenticator or another TOTP app, add an account and scan the QR. You can
   instead enter the manual key: TOTP, SHA-1, six digits, 30-second period.
3. Confirm with the current password and an authenticator code within ten minutes.
4. Sign in again with password and a new code. Activation signs out every device.

The setup ticket is encrypted, owner-bound, time-limited and tied to the account's
session epoch. No unconfirmed factor is persisted. The key and QR appear only
in the private password-confirmed setup response, not in public HTTP URLs,
public DTOs or browser storage. The QR encodes the same secret and standard
`otpauth://totp` settings as the manual key. It contains no password or setup
ticket. It is generated locally on the frontend server and rendered as inline
SVG, with no external QR service or additional image request.
Do not share the QR or include it in public screenshots. Save any needed backup
in a secure password manager, not in this repository.

Codes allow one 30-second step of clock skew. Successful enrollment, login and
factor removal consume the step through a serialized database operation.
Reusing the code, including concurrent attempts, fails. After signing in, wait
for a new code before disabling the factor. Removal requires both the current
password and that fresh code, and also signs out every device.

Reader accounts cannot enroll. Demoting an administrator does not silently
remove its existing factor. Password changes, email password recovery and
operator password rotation retain the factor.

### Lost authenticator

First restore the original encryption key if configuration was lost. If the
authenticator itself is lost, use the explicit offline operator command only
after checking the account owner's identity through a trusted channel.

Source checkout after building:

```sh
pnpm user:totp:reset
```

Packaged application: `npm run user:totp:reset`.

The command reads bounded private JSON from stdin, not command arguments:
`{"username":"operator","confirmation":"DISABLE_TOTP"}`.
Pipe it from a private input source using the existing account-recovery procedure.
No command runs implicitly. Recovery removes only the selected account's factor,
revokes every session and outstanding password-reset token, and records
`totp.disabled` with a null operator actor. It does not change the password.
Re-enroll promptly and investigate any unexpected recovery entry.

## Sessions, comments and moderation

The ordinary logout endpoint still signs out one device.
`POST /api/auth/logout/all` advances the account's session epoch and deletes its
sessions atomically. A login that races revocation cannot revive an old epoch.
Password rotation also removes outstanding recovery tokens.

Comment submission has a default quota of five requests per minute for each IP
and each presented session token. Both quotas must pass. The existing overall
request limit still applies. Quota state contains token hashes, not raw tokens,
and has a bounded client count. Rejected submissions return 429 with `Retry-After`.
GET comment requests do not consume the submission quota.

The hidden `website` field is a first-party honeypot. Nonempty submissions return
the same 202 acknowledgement but create no comment. Real comments remain pending
until an administrator approves them at `/admin/comments`; rejected or pending
comments never appear in public lists. Validation, trusted Origin and audience
checks still run for honeypot submissions. No CAPTCHA service or Akismet is used.

Quotas are process-local, not a shared distributed limiter. Cold starts and
multiple replicas reset or multiply them. Add a trusted ingress-level quota for
strict fleet-wide enforcement, and verify trusted peer forwarding on the host.
Anonymous bots that avoid the honeypot still require moderation.

## Security history and deletion

`/admin/audit` and `GET /api/admin/audit` show newest-first pages of 50 events.
Reader and guest access is denied. Responses are no-store and pages are noindex.
Records contain event name, actor/target UUIDs, count and timestamp, never
passwords, tokens, TOTP material, IP addresses, emails or content bodies.

Account creation/management, password changes/recovery, global logout, TOTP
changes and post deletion write audit records in the same PostgreSQL transaction
as their mutation. CLI account provisioning and recovery use the same tables.
Comment moderation/deletion are recorded after the repository mutation and are
not claimed to be transactionally coupled.

The admin ledger lets an administrator select records on the current page and
type `DELETE`. `POST /api/admin/posts/delete` accepts 1–100 UUIDs with that explicit
confirmation, deduplicates them and records the actual deletion count in the
same transaction. Single-post deletion is audited too. Missing records do not
inflate counts. Database cascades remove linked comments, likes and tag links.

The application provides no edit/delete endpoint for security events. The log is
not tamper-proof against a database operator, and no automatic retention cleanup
is introduced. Plan retention and backups before production use.

## Verification and publication

### Public pages and discovery

`/about`, `/help`, `/privacy` and `/cookies` provide localized site information.
The shared footer links these pages, RSS and the sitemap. The root error
boundary keeps SvelteKit's real response status, avoids upstream diagnostics
and offers archive search on 404s. Error responses have no canonical URL and
are noindex/no-store.

The sitemap includes the public static pages, graph, published post metadata
and topics. Account, administration, login and recovery routes are excluded
from crawler directions; those directions are not access controls. The sitemap
remains paginated. Both XML discovery documents escape content and return 503
rather than an empty success document when the API is unavailable.
RSS autodiscovery appears in the document head.

The cookie inventory now includes `like_voter`. Privacy text describes the
application, not invented operator identities, provider policies or retention
guarantees. Operators still need to supply their own contact and hosting details.

### Local checks

Run from the repository root:

```sh
pnpm release:check
pnpm check
pnpm test
pnpm lint
pnpm format
pnpm build
pnpm test:vercel-api
```

Regression tests cover RFC 6238 vectors, encryption binding, ticket expiry,
concurrent code replay, session revocation, honeypot filtering, independent IP
and session quotas, role isolation, pagination, confirmed deletion, safe browser
actions and generated transaction SQL. These do not prove native PostgreSQL
concurrency, SMTP delivery or a hosted deployment.

Local verification passed 223 API and 252 frontend tests, workspace/runtime
typechecks, lint, production builds, release metadata and credential-free Vercel
API packaging. Synthetic browser checks covered selected deletion, audit/settings
access, global logout and TOTP activation followed by password-only denial.
The new screens had no horizontal overflow at 390px. Selected WCAG A/AA audits
reported no violations; the ledger had one incomplete contrast check.
This is not a full accessibility audit.
The public-page follow-up adds 24 regressions and verifies the live information
pages, robots, sitemap, RSS, missing routes and missing post slugs in Italian.
Both missing-route cases return an actual noindex 404 without canonical metadata.
The 404, project overview, guide and privacy screens had no horizontal overflow
at the browser pane's 356px viewport. Their selected WCAG A/AA checks reported
no violations or incomplete checks. Recovery search reached the real archive.

The QR follow-up adds 21 regressions, including independent decoding of the SVG
geometry, otpauth setting/secret validation and protected setup rendering.
No live account was enrolled or modified for these tests.

The layout and code-input follow-up adds seven regressions. Synthetic pages
rendered from the real components and production CSS had no horizontal overflow
at 320, 390, 760 and 1280px. Post selection remained connected to the bulk form.
Native browser validation accepted six-digit codes, including leading zeros,
and rejected shorter or nonnumeric values in enrollment, removal and login.
The login code remains optional until the server requires a factor.

The full `pnpm format` check passes. The CSS animation rules were reformatted
without changing behavior. Windows-only CRLF checkout differences were normalized
locally; unrelated tracked content did not change. The production build reports
Vite's existing warning about `NODE_ENV` in a local environment file.
Builds and API packaging still passed.

Before deploying, run the database integration checks against a dedicated
`*_test` database, test multiple API replicas with one key, and exercise actual
enrollment/login/recovery over HTTPS on the target host. Verify backup recovery
and ingress-level anti-spam policy.

Packaging, tagging, pushing, publication and hosted migrations remain separate
authorized operator actions.
