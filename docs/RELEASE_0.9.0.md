<!-- @file RELEASE_0.9.0.md -->
<!-- @brief Verified stabilization work and remaining gates before releasing 0.9.0. -->

# Preparing 0.9.0

Version 0.9.0 is **in progress**, not release-ready. Workspace metadata remains
at 0.8.0. This document records local evidence, not a hosted deployment result.
The source of truth for milestone scope is [TODO.md](../TODO.md).

## Deferred testing

At the operator's request, real PostgreSQL recovery, hosted Node/Vercel/R2/SMTP
validation and manual accessibility review remain **to be tested**. These gates
are deferred, not waived or passed. No PostgreSQL installation or test cluster
was created. This checkpoint does not authorize a version bump or release.

## Verified locally

- 324 API and 315 frontend unit tests pass, including OpenAPI, archive/restore,
  explicit-target/path guards and shared-entrypoint wiring regressions.
  The real PostgreSQL recovery test is explicitly skipped, not passed.
- Workspace/runtime typechecks and frontend lint pass. New backup/shared-wiring
  sources pass formatting; a repository-wide formatting result is not claimed.
- Node and Vercel production builds and credential-free Vercel API packaging pass.
- The compiled backup CLI's help path runs without database access.
  The final Node release bundle and PostgreSQL-backed bundle smoke remain pending.
- Chromium passes 96 checks per local API transport, Node HTTP and the Vercel
  Node handler through its Fetch adapter. Both use the production Node frontend.
- Browser checks cover 31 reader/admin route cases in light/dark/OLED at 390px,
  selected automated WCAG 2.1 A/AA rules, skip links and horizontal overflow.
- The CSS customization pass adds a validated override layer, shared tokens,
  a contributor guide and 98 Node-fixture accessibility/customization checks
  including 320/390/768/1280px widths. These newer checks were not rerun through
  the serverless transport; the earlier parity evidence above remains separate.
- An offline OpenAPI 3.1 baseline covers 58 current operations across 46 paths,
  with structural/reference, router-inventory, regeneration and sampled HTTP
  model checks. API v1 compatibility approval remains a separate 1.0.0 gate.
- Real form journeys cover login, draft creation, publication and global logout,
  including preservation of unsaved editor fields while editing the body.
- SSR social metadata and parsed RSS/sitemap checks pass. Unit tests cover
  XML-safe Unicode, theme-token contrast, pool configuration and readiness.

Run commands and fixture limitations are in [Testing](TESTING.md).
Memory fixtures do not establish PostgreSQL or hosted-service correctness.
The prior browser evidence above was not rerun for the backend-only backup/wiring
changes. No live database, bucket, SMTP mailbox or hosted deployment was changed.

## Completion gates

### Hosted deployment and runtime parity

- [ ] Run actual Node/Vercel journeys against isolated staging data, including
      service bindings, session cookies, trusted origins and private-content masking.
- [ ] Verify PostgreSQL persistence and pooled connections under concurrent
      instances; measure and record cold/warm latency against agreed limits.
- [ ] Verify configured R2 uploads/downloads and SMTP delivery using staging
      resources, not production accounts or public subscriber lists.
- [x] Explicitly document the scheduler difference. Vercel currently
      disables scheduling; it has no cron or request-triggered publisher.
- [x] Define the abuse-control boundary for multiple instances. Process-local
      quotas are not a fleet-wide limiter; enforce shared limits at trusted ingress
      or implement a suitable shared mechanism where strict enforcement is required.

See [runtime boundaries and staging evidence](RUNTIME_PARITY.md). Shared ingress
is an operator requirement, not an implemented shared limiter or a passed staging
check. Standalone, unified Node and Vercel now share service wiring; the previous
unified-Node omissions of email/newsletter/R2 are corrected locally.

Both Vercel services target Node.js 24, not Edge. Follow
[Vercel deployment](VERCEL_DEPLOYMENT.md); a local Fetch adapter is not hosted E2E.

### Manual accessibility

- [ ] Review reader/admin journeys with a screen reader and keyboard.
- [ ] Review zoom, OS high-contrast mode and all three themes.
- [ ] Review interactive/error states and content-specific image alternatives.

Automated axe results are not WCAG certification.

### Backup and restore

- [x] Implement CLI export/import for the complete database and image archive.
- [ ] Prove recovery into isolated empty state, including content, accounts,
      relationships and media; define safe failure and overwrite behavior.
- [x] Document the format, commands and separately protected secrets required
      for recovery. Never include credentials in Git or a public release artifact.

See [backup and empty-target recovery](BACKUP.md). Archive/local/R2 protocol
regressions pass without credentials. The real native PostgreSQL drill is
explicitly opt-in and remains unrun: this host has no PostgreSQL clients on
`PATH` and no three dedicated empty test databases configured. Existing content
import is not a complete restore. Partial external-storage failures remain
isolated and require a fresh empty target; no state is automatically deleted.

### Release preparation

- [ ] Close or explicitly approve and document any change to the scope above.
- [ ] Update workspace versions and changelog, then run `pnpm release:check`
      and all applicable quality gates against the final candidate.
- [ ] Prepare the Node artifact and recovery instructions.
- [ ] Obtain separate authorization for the version tag and hosted release.

No new schema migration is introduced by this stabilization work.
Git push may trigger configured CI/CD; it is not evidence that deployment passed.
