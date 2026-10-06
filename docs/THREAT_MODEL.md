<!-- @file docs/THREAT_MODEL.md -->
<!-- @brief Security assets, trust boundaries, attacker capabilities, and residual risks. -->

# Threat model

Security model behind BENCHCORE. Every control below is enforced in
`api/src/` (Origin guard, rate limits, sanitizer, repository parameterization)
with the frontend CSP in `frontend/`; report new vectors privately under
[SECURITY.md](../SECURITY.md).

## Scope

A self-hosted personal publishing application with a trusted operator and an
authenticated editorial account. It is not a hardened multi-tenant SaaS,
encrypted vault, private file-sharing service, or distributed abuse platform.

This document explains intended controls and remaining risks; it is not a
claim of an external audit or a security certification.

## Assets and boundaries

| Asset | Boundary |
|---|---|
| Admin credentials | Browser/login API to password verifier; hashes in DB |
| Session tokens | HttpOnly cookie to API; only hash persisted |
| Unpublished content | Authenticated admin versus public repository/DTO paths |
| Published HTML | Untrusted Markdown to sanitizer to browser rendering |
| Uploaded files | Authenticated input to validated key/provider to public bytes |
| Database | Services to repository implementations; no browser SQL access |
| Secrets/backups | Operator environment and protected storage, outside Git |
| Availability | Public HTTP and costly rendering/auth/storage operations |

The authoring/import CLI is a trusted operator path. The reverse proxy is
trusted only to the extent its deployment and forwarded-header behavior are
explicitly configured.

## Attacker capabilities

Assume an unauthenticated remote attacker can send arbitrary requests, vary
Origin/Host/body/query fields, guess slugs/keys, and repeatedly attempt login.
A malicious website can cause cross-site browser requests. An authenticated
editor can submit hostile Markdown/images; editor access does not justify
unsafe rendering.

A compromised operator account, database, host, dependency, or CI credential
is a more powerful adversary. Application checks do not prevent a host
administrator from reading disk/database contents.

## Threats and controls

| Threat | Intended control | Residual risk/operator action |
|---|---|---|
| Credential theft or guessing | scrypt hashes, timing-safe verification, login limits, HTTPS | No claimed MFA; use a unique strong password and protect operator access |
| Session spoofing | Cryptographic random tokens, hash lookup, expiry, HttpOnly/Secure/Lax cookies | Stolen cookies remain sensitive; revoke sessions after compromise |
| Cross-site mutation | Exact Origin allowlist on API writes and trusted server-action forwarding | Origin is not auth; non-browser clients can supply it |
| Draft disclosure | Central visibility rules and masked public 404 | Verify every new surface: search/counts/backlinks/feed/sitemap |
| Stored XSS | Sanitized Markdown, escaped links, frontend CSP | CSP is defense in depth; preserve sanitizer coverage |
| SQL injection | Validated inputs and repository-owned parameterized queries | Review any new raw/dynamic SQL carefully |
| Path traversal | Restricted generated media keys and backend validation | Operator-controlled directories still need safe permissions |
| Hostile uploads | Image MIME allowlist, decoded/body limits, safe keys | Allowlisted MIME alone is not antivirus or a guarantee of file authenticity |
| Resource exhaustion | Body/field caps and bounded in-memory rate counters | Limits reset/repartition by process; add trusted edge controls |
| Framing/sniffing/content execution | Response security headers and CSP | Verify actual production headers and proxy overrides |
| Data loss/tampering | Reviewed migrations, source control, backups and restore drills | No automatic revision restore; import can overwrite edits |
| Supply-chain compromise | Pinned versions, lockfile, review and CI | Pinning does not prove a dependency is safe |
| Sensitive logging | No application analytics; operator redaction policy | Infrastructure can still record IPs, paths, and timings |

## Media is public

`GET /api/media/:key` is public. A difficult-to-guess key is not an authorization
scheme. Uploading to a draft does not create a private attachment.

Long-lived caches may retain deleted images. Do not upload secrets or personal
documents that require revocation guarantees. Database media changes storage
location, not public access semantics.

## Scheduling and revisions

Scheduling must not bypass normal public eligibility. Test future dates and
due processing with the same service visibility rules. Process timers can
delay publication during downtime; multiple replicas need concurrency review.

Revision-table groundwork is not an audit log or recovery guarantee. Do not
depend on it to detect unauthorized changes or restore deleted records.

## Rate-limit limits

Counters are bounded in memory, not shared across hosts and not persisted.
They are an application-level guard against straightforward abuse, not
distributed denial-of-service protection.

Do not trust arbitrary `X-Forwarded-For` as identity. Define which proxy can
set forwarding headers and enforce shared traffic policy there. Use timeouts,
connection limits, and capacity monitoring appropriate to your host.

## Privacy

The application does not collect analytics and contains no third-party
trackers or telemetry SDKs. It necessarily stores operational application
data such as admin email, posts, sessions, and uploaded media.

Hosting providers, proxies, databases, and security tools may keep request/
access logs. Configure their retention and access separately. External URLs
that an author intentionally embeds can cause visitors to contact those
external hosts; the no-trackers statement is about built-in application code,
not a promise that arbitrary authored content never loads remote resources.

## Review checklist

For changes to any input, rendering, visibility, authentication, or storage
boundary:

1. Identify attacker-controlled values and where validation occurs.
2. Check all public response paths for unpublished data/count leakage.
3. Add negative tests, not only a successful happy path.
4. Keep exceptions out of public error responses.
5. Avoid secret-bearing logs and test fixtures.
6. Verify production headers/CSP with actual UI assets.
7. Document any new residual risk and deployment requirement.

Use [SECURITY.md](../SECURITY.md) for private vulnerability reporting.
