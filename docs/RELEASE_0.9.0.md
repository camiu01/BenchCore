<!-- @file RELEASE_0.9.0.md -->
<!-- @brief Verified stabilization work and remaining gates before releasing 0.9.0. -->

# Preparing 0.9.0

Version 0.9.0 is **in progress**, not release-ready. Workspace metadata remains
at 0.8.0. This document records local evidence, not a hosted deployment result.
The source of truth for milestone scope is [TODO.md](../TODO.md).

## Verified locally

- 284 API and 314 frontend unit tests pass.
- Workspace/runtime typechecks, frontend lint and formatting pass.
- Node and Vercel production builds and credential-free Vercel API packaging pass.
- Chromium passes 96 checks per local API transport, Node HTTP and the Vercel
  Node handler through its Fetch adapter. Both use the production Node frontend.
- Browser checks cover 31 reader/admin route cases in light/dark/OLED at 390px,
  selected automated WCAG 2.1 A/AA rules, skip links and horizontal overflow.
- Real form journeys cover login, draft creation, publication and global logout,
  including preservation of unsaved editor fields while editing the body.
- SSR social metadata and parsed RSS/sitemap checks pass. Unit tests cover
  XML-safe Unicode, theme-token contrast, pool configuration and readiness.

Run commands and fixture limitations are in [Testing](TESTING.md).
Memory fixtures do not establish PostgreSQL or hosted-service correctness.

## Completion gates

### Hosted deployment and runtime parity

- [ ] Run actual Node/Vercel journeys against isolated staging data, including
  service bindings, session cookies, trusted origins and private-content masking.
- [ ] Verify PostgreSQL persistence and pooled connections under concurrent
  instances; measure and record cold/warm latency against agreed limits.
- [ ] Verify configured R2 uploads/downloads and SMTP delivery using staging
  resources, not production accounts or public subscriber lists.
- [ ] Resolve or explicitly document the scheduler difference. Vercel currently
  disables scheduling; it has no cron or request-triggered publisher.
- [ ] Define the abuse-control boundary for multiple instances. Process-local
  quotas are not a fleet-wide limiter; enforce shared limits at trusted ingress
  or implement a suitable shared mechanism where strict enforcement is required.

Both Vercel services target Node.js 24, not Edge. Follow
[Vercel deployment](VERCEL_DEPLOYMENT.md); a local Fetch adapter is not hosted E2E.

### Manual accessibility

- [ ] Review reader/admin journeys with a screen reader and keyboard.
- [ ] Review zoom, OS high-contrast mode and all three themes.
- [ ] Review interactive/error states and content-specific image alternatives.

Automated axe results are not WCAG certification.

### Backup and restore

- [ ] Implement CLI export/import for the complete database and image archive.
- [ ] Prove recovery into isolated empty state, including content, accounts,
  relationships and media; define safe failure and overwrite behavior.
- [ ] Document the format, commands and separately protected secrets required
  for recovery. Never include credentials in Git or a public release artifact.

The CLI is not implemented. Existing content import is not a complete restore.

### Release preparation

- [ ] Close or explicitly approve and document any change to the scope above.
- [ ] Update workspace versions and changelog, then run `pnpm release:check`
  and all applicable quality gates against the final candidate.
- [ ] Prepare the Node artifact and recovery instructions.
- [ ] Obtain separate authorization for the version tag and hosted release.

No new schema migration is introduced by this stabilization work.
Git push may trigger configured CI/CD; it is not evidence that deployment passed.
