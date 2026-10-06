<!-- @file RELEASE_0.7.0.md -->
<!-- @brief Local 0.7.0 preparation, maintenance safety and separate publication gates. -->

# Preparing 0.7.0

Version 0.7.0 includes the unfinished 0.6 media work and the 0.7 knowledge
navigation milestone. Preparing source and artifacts does not publish a release
or deploy the application.

## What changes

- Linked-post hover/focus previews, fuzzy title/slug/tag completion, reader TOC
  and fitted/focused graph navigation.
- Multi-tag AND/OR archive filters and update/like ordering. Reader-only body and
  engagement privacy applies to every new projection and query.
- Immediate R2 upload previews, workflow percentage progress, per-file retry and
  queued/saved image reordering. Only safe stand-alone Markdown image paragraphs
  move; code and other text do not.
- Dry-run-first orphan cleanup and private media cache controls.
- Stable version validation, Node packaging and separate stable/beta release gates.

The strict direct-upload limits alternative was chosen instead of an image
compression pipeline: PNG/JPEG/WebP/GIF, positive size up to 5 MiB, exact signed
length/type, owner-bound completion and conditional immutable publication.
MIME checks are not image decoding. There is no claimed resizing, AVIF conversion,
virus scan or metadata stripping. Prepare images before uploading.

Byte progress uses XMLHttpRequest without credentials. It rejects a final URL
different from the signed URL, but the browser may already have followed that
redirect. This is not a network-level redirect prohibition. Use only the validated
R2 endpoint and verify its actual CORS and upload behavior before deployment.

No migration is added by 0.7.0. Apply any previously pending committed migrations
explicitly before running new code. Never migrate the configured database as
part of a local unit test.

## Orphan cleanup

Source checkout:

```sh
pnpm media:cleanup --dry-run --limit 100
```

Built checkout: `pnpm media:cleanup:production --dry-run --limit 100`.
Packaged application: `npm run media:cleanup -- --dry-run --limit 100`.
Omitting the mode still means dry-run. Reports contain counts, not filenames,
object URLs, credentials or post bodies. Limits are 1–1000, default 100.

Before applying:

1. Back up the database and selected media backend; verify recovery.
2. Stop all application writers, scheduled jobs and upload clients. Save or close
   every editor; uploads not yet saved into a post are indistinguishable from orphans.
3. Run dry-run against the intended backend and inspect the counts.
4. Explicitly run `pnpm media:cleanup --apply --maintenance --limit 100`
   (the equivalent packaged command also requires both flags).
5. Repeat bounded batches only while maintenance remains active, then restart writers.

The scan conservatively protects every saved key mention, including absolute
URLs, HTML/Markdown images, covers and ambiguous prose/code references, across
all statuses and audiences. An ambiguous mention is retained for manual review,
not treated as an orphan. Each candidate is checked again and passed to
the existing deletion service. No timestamp/grace period or distributed lock is
claimed: concurrent writers must stay stopped through deletion. Nothing schedules
this CLI automatically. R2 staging objects without completed metadata are excluded;
use a separately reviewed bucket lifecycle rule for abandoned staging uploads.

## Cache policy

Public local/database images use private browser ETags and mandatory revalidation.
Authorization runs before conditional responses, so an old public ETag cannot
bypass a later audience change. Reader-only bytes and short-lived R2 URLs use
private/no-store. R2 objects and signed reads explicitly carry no-store policy.
Shared CDN caches are disabled for mutable-audience media. Previously downloaded
bytes and already issued signed read links cannot be revoked retroactively.

## Local checks

```sh
pnpm install --frozen-lockfile
pnpm release:check
pnpm check
pnpm test
pnpm lint
pnpm format
pnpm build
pnpm release:package
pnpm test:vercel-api
```

The Node bundle is `artifacts/benchcore-0.7.0`; existing versioned bundles are
never overwritten. `beta:package` remains a compatible alias. Run `pnpm test:beta`
and `pnpm test:bundle` only against a dedicated loopback `*_test` database, with
`BETA_BUNDLE` pointing to the new bundle. These checks include real SQL tag grouping,
popularity redaction, preview privacy and the compiled cleanup dry-run.

### Evidence and outstanding checks

Verified locally on Windows:

- All 356 unit/regression tests passed: 185 API and 171 frontend.
- API, frontend and runtime type checks passed; Svelte reported no errors or warnings.
- Lint, formatting, Node builds, both Vercel service builds and stable version
  validation passed.
- The refreshed `artifacts/benchcore-0.7.0` bundle passed the isolated SQL smoke.
  Source and packaged checks covered tag grouping, popularity and preview privacy,
  archive SSR and the compiled cleanup dry-run.
- Credential-free API packaging loaded the real Vercel output, passed liveness
  and verified that missing database configuration fails lazily.
- Synthetic browser checks covered linked/graph previews, Escape focus restoration,
  archive filters, fuzzy suggestions, image reordering and decoded blob previews.
  Selected archive/editor axe checks reported zero violations and zero incomplete
  results. This is not a complete accessibility audit.
- Security-sensitive changes were reviewed against the local STRIDE model.
  Cleanup now conservatively preserves absolute image URLs and ambiguous saved
  key mentions; regression tests passed.

The disposable PGlite wire-protocol server needed `prepare=false&max=1` to avoid
its concurrent/prepared-session protocol error. Application database defaults
were not changed. Native PostgreSQL 17 concurrency and Linux archive execution
remain remote gates, not locally verified results.

The optional size audit still flags the existing repository-contract file
(473 lines, including this release's additions) and unchanged global stylesheet
(609 lines). New feature modules and named TypeScript functions satisfy the
size limits; these older oversized files are not claimed to pass the audit.

Packaging also reports the existing SvelteKit/TypeScript peer-version mismatch,
deprecated transitive build packages and a Windows `marked` bin-link warning.
Builds and runtime smoke passed despite those warnings. Native production
execution, real R2/CORS, release approval protections and backup recovery still
need operator verification.

## Publishing is separate

Branch pushes and manual CD runs produce verified artifacts only. A matching
`v0.7.0` tag selects a stable GitHub release behind the `stable-release`
environment; numbered beta tags use `beta-release` and `--prerelease`.
All workspace versions must match the exact tag. The publish job checks archive
checksums and requires the tag to exist; it does not deploy.

Before an operator tags/publishes:

- Configure required reviewers and tag restrictions for `stable-release`;
  also protect `main` and release tags. An environment name alone is not approval protection.
- Run green remote CI/CD, including PostgreSQL 17 and the actual Linux bundle.
- Verify HTTPS, trusted origins/proxy settings, database TLS and rotated admin passwords.
- Exercise real private R2 browser uploads/CORS, publication and signed reads.
- Verify persistent storage and perform a backup/restore drill on the target host.

No release tag, hosted release, push, deployment, live cleanup or configured
database migration is authorized by this preparation task.
