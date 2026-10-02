<!-- @file SECURITY.md -->
<!-- @brief Supported security scope, confidential reporting, privacy, and deployment responsibilities. -->

# Security Policy

## Supported versions

Only the latest commit on `main` is actively maintained. The 0.5.0 milestone
is a local repository version, not a promise of a published or hosted release.

| Version | Supported |
|---|---|
| Current `main` | Yes |
| Older snapshots/releases | No dedicated backport commitment |

## Reporting issues

For exploitable vulnerabilities, use the repository's
[private vulnerability reporting](https://github.com/camiu01/legendary-octo-bassoon/security/advisories/new)
if enabled. If that channel is unavailable, contact the maintainer privately
at **lorenzo.camuso@gmail.com**. Do not publish a working exploit, private
content, or credentials in a public issue before coordination.

Include:

- Affected commit and deployment configuration, with secrets removed.
- Attack surface and prerequisites.
- Minimal reproduction using disposable accounts/content.
- Expected versus actual behavior and impact.
- Any suggested mitigation, without changing a live deployment.

Ordinary nonsecurity bugs can use the standard issue templates. Maintainers
will assess reports and coordinate fixes/disclosure; no fixed response SLA or
bug-bounty payment is promised.

## Input surfaces to keep hardened

- **Login/session** — scrypt passwords; opaque random tokens, hash-only
  persistence, expiry, HttpOnly/SameSite/Secure cookie behavior.
- **Mutations** — Zod validation, authenticated use cases, exact Origin checks
  against `SITE_URL` and comma-separated `API_ALLOWED_ORIGINS`.
- **Markdown/TOML** — bounded fields, safe parser behavior, sanitized HTML,
  escaped wikilinks, no unsanitized preview/rendering path.
- **Public reads** — draft, archived, and future content must not leak through
  detail, list/count, search, tags, backlinks, RSS, or sitemap.
- **Media** — bounded image uploads, allowed types, validated generated keys,
  backend-independent rejection of traversal and unsafe input.
- **Search/database** — repository-owned queries, generated-vector migrations,
  safe query construction, no browser database access.
- **Response headers** — API security headers and frontend CSP; verify actual
  production behavior rather than assuming a proxy preserves it.

Read the [Threat model](docs/THREAT_MODEL.md) for limits and residual risks.

## Deployment responsibilities

Use HTTPS and unique strong credentials. Keep database ports private, protect
admin access, restrict exact allowed origins, and maintain tested encrypted
backups. Never commit `.env`, database dumps, production cookies, credentials,
or private authoring data.

Bounded in-memory rate limits are per-process, reset on restart, and are not
distributed denial-of-service protection. Add trusted infrastructure controls
for public deployments. A compromised host/database remains outside what
application-level validation can contain.

Uploaded media is **public by key**, including images referenced from drafts.
Immutable caches may retain deleted bytes. Do not upload content requiring
private-access or reliable revocation guarantees.

Revision tables are groundwork, not an audit trail or backup substitute.
Scheduled publication depends on the API process and its clock.

## Privacy and telemetry

The application **does not collect analytics and includes no third-party
trackers or telemetry SDKs**. It stores functional application data, including
posts, admin identity, password/session hashes, and media.

Infrastructure can log requests, IP addresses, paths, user agents, and timing.
Operators own those systems' retention, access, and redaction policies.
External resources intentionally embedded by an author may contact external
hosts; do not confuse that with a built-in tracking integration.
