<!-- @file docs/TESTING.md -->
<!-- @brief Automated quality gates, regression expectations, and manual smoke tests. -->

# Testing

Quality gates behind BENCHCORE. Unit suites live in `api/tests/` and
`frontend/tests/`, browser journeys in `frontend/e2e/`, and packaging checks in
`scripts/`. Service tests use in-memory repositories; CI in `.github/` runs
the automated gates.

## Required checks

Run from the repository root:

```sh
pnpm --filter benchcore-api exec tsc --noEmit
pnpm check
pnpm test
pnpm lint
pnpm format
pnpm build
pnpm build:vercel
pnpm test:vercel-api
pnpm release:check
```

Use Node.js 24 and pnpm 10.15.0. CI should install with
`pnpm install --frozen-lockfile` and run API/frontend typechecks, tests,
frontend lint, formatting and production builds. Version metadata checks do not
publish anything. For current evidence and open operator gates, see
[0.9.0 preparation](RELEASE_0.9.0.md).

`pnpm check` covers both packages. The explicit API TypeScript command is
useful for a focused check. Passing a build alone is not a substitute for all gates.

## Focused tests

### Browser, accessibility and discovery

```sh
pnpm --filter benchcore-frontend exec playwright install chromium
pnpm build
pnpm test:e2e
```

The browser suite owns a loopback-only listener on `127.0.0.1:5198` and refuses
to reuse an existing server. It loads compiled production artifacts with
in-memory repositories, synthetic accounts and temporary local media, never
the application's `.env` or a live PostgreSQL/SMTP/R2 service.
`E2E_TARGET=serverless` selects the Vercel API handler plus Fetch adapter; CI
runs both transports. The frontend uses the Node adapter in both fixture modes,
not a hosted Vercel deployment.

After `pnpm build`, run both modes in a POSIX shell:

```sh
E2E_TARGET=node pnpm test:e2e
E2E_TARGET=serverless pnpm test:e2e
```

In PowerShell, set `$env:E2E_TARGET = 'node'` or `'serverless'` before each
`pnpm test:e2e` run. Remove the variable afterward with
`Remove-Item Env:E2E_TARGET`. Run browser checks before `pnpm build:vercel`,
which replaces generated frontend output; rebuild with `pnpm build` before
returning to browser fixtures.

Checks cover every current reader/admin page template in light/dark/OLED at
390px, automated axe WCAG 2.1 A/AA rules, one main landmark/heading, skip-link
keyboard navigation and horizontal overflow. Separate journeys exercise real
login/publishing/logout forms, anonymous draft masking, SSR Open Graph/Twitter
metadata and XML parsing of RSS/sitemap in Chromium. Unit tests measure actual
theme-token contrast and reject forbidden XML 1.0 characters.
Failure traces are retained as CI artifacts.

Automated checks are not a WCAG certification. Screen-reader usability, zoom,
high-contrast OS modes, content-specific image alternatives, interactive error
states and hosted services still require manual review. Do not mark hosted
deployment parity or measured cold-start performance complete from these tests.

Vitest suites live in each package's `tests/` directory:

```sh
pnpm --filter benchcore-api exec vitest run tests/password.test.ts
pnpm --filter benchcore-frontend exec vitest run tests/theme.test.ts
```

Service tests use in-memory repositories, not production PostgreSQL.
Do not configure real secrets merely to run unit tests.
Use temporary, isolated storage for filesystem tests.

## Regression matrix

| Area | Required assertions when changing it |
|---|---|
| Frontmatter | Missing fences, invalid TOML, bounds, timezone-qualified dates |
| Markdown | Unsafe HTML/schemes removed, safe formatting preserved |
| Wikilinks | Escaped labels/targets, custom labels, broken targets, backlinks |
| Publishing | Draft/archived/future excluded from detail/list/search/counts |
| CRUD/import | Duplicate slugs, update by UUID, upsert by slug, per-file errors |
| Sessions | Password failures, token hashing, expiry, logout, cookie flags |
| Origin | Missing/untrusted origins rejected, exact trusted origins accepted |
| Rate limits | Rejection/backoff behavior, bounded state, independent instances |
| Search | Matching semantics, pagination/tag combination, no private results |
| Scheduling | Not due stays private, due processing, clearing schedule, repeat ticks |
| Media | MIME/size/key validation; save/load/remove parity across providers |
| Media maintenance | Dry-run never deletes, bounded apply, every saved status/audience protected, concurrent-use rechecks |
| Media caching | Current audience checked before 304; reader-only/R2 no-store, no shared CDN caching |
| Upload UI | Immediate preview cleanup, measured progress, retry skips successes, safe queue/Markdown reordering |
| Knowledge navigation | Locked/draft preview redaction, target validation, cancellation, fuzzy title/slug/tag ranking |
| Archive | Multi-tag AND/OR, identical count filters, stable update/like sorting, guest engagement redaction |
| Release | Workspace versions match, exact tag, separate stable/beta approval gates, allowlisted artifact |
| Frontend | DTO validation, admin guard, server-only cookie forwarding |
| Headers/CSP | Expected headers and working scripts/styles/media in production |
| Themes | Persistence, invalid stored preference, three-theme presentation |

Use a fixed/injected clock when testing scheduling and expiry. Do not create
minute-long sleeps to wait for production timers. Test policy directly and
cover wiring separately.

## PostgreSQL smoke tests

Memory repositories do not verify SQL migrations, generated search vectors,
GIN indexes, or blob persistence. Against a **disposable PostgreSQL 17**
database:

1. Apply all committed migrations to an empty database.
2. Seed/import representative drafts, published and archived posts.
3. Exercise real search, multi-tag AND/OR and update/popularity sorting with guest redaction.
4. Update searchable content and confirm the generated vector changes.
5. Process due schedules and confirm public eligibility.
6. Upload/load/delete in database media mode.
7. Restart the API and verify persisted content/media remains available.
8. Test an upgrade from the previous supported schema.

Never run destructive setup/teardown against a production `DATABASE_URL`.
Record which checks were actually performed; do not claim database coverage
from memory-only tests.

## Manual smoke checklist

- [ ] Home/posts/detail/tags, pagination, search, missing slug.
- [ ] Draft/archived/future slugs return the same public 404.
- [ ] Login, protected admin navigation, logout, expired-session behavior.
- [ ] New post, edit/save, preview sanitization, duplicate-slug error.
- [ ] Schedule a draft, clear schedule, observe due publication.
- [ ] Image upload, alt text, cover URL, image retrieval after restart.
- [ ] Local and database provider modes tested independently.
- [ ] Theme selection persists across reload with no obvious first-paint flash.
- [ ] Light/dark/OLED contrast, keyboard focus, narrow-screen tables/forms.
- [ ] Canonical URLs, sitemap, RSS, robots use the correct external origin.
- [ ] CSP does not break theme initialization, hydration, preview, or images.
- [ ] Trusted Origin accepted, untrusted Origin rejected, rate limit reached.
- [ ] Backup restored into isolated state and verified.

Only perform destructive delete/abuse-limit tests against disposable content.
See [Operations](OPERATIONS.md) for a recovery drill.
