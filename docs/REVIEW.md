<!-- @file docs/REVIEW.md -->
<!-- @brief Resolved review findings and validation records through the prepared Node beta. -->

# Review and validation

Review record behind BENCHCORE. Every finding below was verified against
`api/src/`, `frontend/src/` and `runtime/` with regression tests where the
behavior is testable; this is a code review and release check, not a
guarantee against all security issues or an independent penetration test.

Reviewed the API router, authentication, content pipeline, publishing services,
repositories, media providers, frontend routes/components, deployment wiring
and configuration. Fixes include regression tests where behavior is testable.
This is a code review and release check, not a guarantee against all security
issues or an independent penetration test.

## Resolved findings

| Priority | Verified problem | Resolution |
|---|---|---|
| P1 | Public tag enumeration disclosed draft-only names | Public tags require visible posts; full registry has a protected endpoint |
| P1 | API administrator actions accepted any authenticated role | Protected reads and writes require `role=admin` |
| P1 | Mutations had no exact-origin enforcement or login quotas | Origin guards, bounded peer quotas and security headers |
| P1 | SvelteKit 3 runtime origin handling rejected legitimate HTTP form submissions | Trusted canonical-origin bootstrap, with overwritten private adapter headers |
| P1 | Production adapter's 512 KiB default blocked advertised image uploads | Explicit 8 MiB frontend request cap; full 5 MiB upload verified |
| P2 | Large base64 regex validation could overflow at the supported upload limit | Non-repeating-group validation and a full-limit regression test |
| P2 | Oversized JSON destroyed the socket before a 413 could be delivered | Bounded body reader drains excess input and preserves error responses |
| P2 | Malformed cookie escapes caused request failures | Invalid cookie pairs are ignored; prototype-free cookie maps |
| P2 | Repository contract syntax/implementation mismatches broke type checking | Corrected contracts and split repository implementations |
| P2 | Duplicate tag links could violate the composite primary key | Canonical/deduplicated links and transactional replacement |
| P2 | Deployment lacked frontend server dependencies | Production-only dependencies included in the Node bundle |
| P2 | Relative media URLs did not resolve through the frontend | Narrow validated same-origin media proxy |
| P2 | Windows frontmatter and CLI BOM input failed parsing | CRLF normalization and BOM-safe stdin parsing |
| P2 | Uploads discarded unsaved editor fields | Server-side editor values preserve form state and append uploaded images |
| P3 | Theme colors failed contrast checks; mobile tables overflowed | Theme token fixes, contrast-safe accent text and responsive layout |

Further fixes validate session/admin DTOs, use trusted server-side canonical
URLs, escape feed XML, paginate sitemap generation, allow nullable cover
clearing and keep scheduled drafts private until atomic promotion.

## Packaging maintenance — 2026-10-05

- Dependency installation runs in a metadata-only temporary workspace under
  `artifacts/`, so legacy pnpm bin linking stays within writable owned staging.
- Windows bundles reserve their final directory before creating junctions;
  Linux bundles retain staged publication. Existing releases are not overwritten.
- 95 API and 60 frontend tests, workspace/runtime typechecks, lint and formatting
  pass. Isolated packaging, cleanup, dependency imports, refusal to overwrite,
  and source/packaged PostgreSQL-wire smoke pass on Windows.
- Docker deployment files, scripts, variables and operational instructions are
  removed. Ephemeral PostgreSQL CI services remain integration-test fixtures.
- Native Linux execution is not available locally. Re-run GitHub CD after these
  changes are published; remote workflow outcomes still require verification.

## 0.6.0-beta.1 verification

- 95 API and 54 frontend tests, workspace/runtime typechecks, lint, formatting
  and production builds pass. Source modules/functions remain within limits.
- Source and actual allowlisted production bundle smoke pass through a local
  ephemeral PostgreSQL wire-protocol server. They cover one-origin routing,
  reader registration/isolation, admin activation changes, and native HTML
  password submission through the SSR bridge with session revocation.
- All four migrations pass embedded PostgreSQL; the authorized account migration
  was applied to the configured database without resetting credentials/content.
- Three read-only review tracks (accounts, runtime/delivery, publishing/frontend)
  returned no actionable findings after the regression checks.
- The configured-database single-port preview serves readiness, API, login and
  registration successfully on 5180. The owned 5181 API listener is stopped.
- Registration has zero violations/incomplete checks under selected WCAG 2 A/AA
  automation; a 390px viewport has no horizontal overflow.
- BenchCore identity appears in page titles, Open Graph and valid escaped RSS.
  The generated `artifacts/benchcore-0.6.0-beta.1` bundle passes the same SQL smoke.
  The homepage contains no milestone appendix, passes selected WCAG 2 A/AA checks
  with zero violations/incomplete checks and fits the 390px viewport.
- Native PostgreSQL 17 simultaneous-admin mutation tests and Linux bundle checks
  are CI gates, not locally executed Linux tests. Remote workflow outcomes
  have not been verified. No hosted release, public deployment or backup/restore
  drill is claimed.
- Existing weak development passwords remain unchanged by design. Rotate them
  at `/account` before exposing the service. Email verification, email resets,
  CAPTCHA and MFA are not shipped in this beta.

## Earlier 0.5.0 validation

- API and frontend typechecks, including API scripts.
- 85 API and 41 frontend tests, frontend lint/format and both production builds.
- Source module/function size checks against repository conventions.
- Three migrations applied to embedded PostgreSQL; generated search-vector
  refresh, GIN index, schedule promotion and revision groundwork verified.
- The authorized configured PostgreSQL accepted all three migrations.
- The requested database account was created without `.env` admin fields;
  username login into the production frontend was verified.
- Production CSP, theme hydration/persistence, search submission, Markdown
  preview, private response headers and full-size upload checked in a browser.
- Light/dark/OLED home and admin pages passed the selected WCAG 2 A/AA
  automated checks. A 390-pixel viewport had no horizontal overflow.
  The empty PostgreSQL admin ledger has no violations but produces an axe
  table-header check requiring manual review until records exist. The beta now
  renders an empty-state card instead of the empty table.

Synthetic content/upload tests ran in local memory/temp storage. No sample
posts were imported or published to the configured PostgreSQL.

## Not performed

- Native Linux artifact execution.
- A production backup/restore drill, load test or independent penetration test.
- Actual release publication or public deployment.
- Live-data search/blob write tests on the configured database; synthetic feature
  checks stayed in isolated memory/embedded PostgreSQL.

The application has no analytics/tracking export configured. Infrastructure
logs and intentionally embedded remote images remain operator/author concerns.
