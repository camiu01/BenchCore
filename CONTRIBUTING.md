<!-- @file CONTRIBUTING.md -->
<!-- @brief Contributor workflow, architecture rules, testing, and pull requests. -->

# Contributing to PERSONAL PUBLISHING PLATFORM

Thank you for considering a contribution — a bug fix, authoring improvement,
security regression test, accessibility fix, or clearer documentation.
Review this guide and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before starting.

---

## Architecture overview

The monorepo separates `frontend/` (SvelteKit presentation) and `api/`
(standalone TypeScript HTTP service). PostgreSQL is runtime truth;
Markdown/TOML is a deliberate import format, not frontend content storage.

```text
api/src/markdown/        # TOML validation and sanitized rendering
api/src/posts/           # publishing rules and use cases
api/src/db/              # contracts, memory doubles, Drizzle SQL
api/src/auth/            # passwords and opaque sessions
api/src/media/           # StorageProvider and backends
frontend/src/lib/        # components, server clients, theme and SEO
frontend/src/routes/     # loads/actions and public/admin pages
```

Read [Architecture](docs/ARCHITECTURE.md) and the nearest `AGENTS.md`.
No direct database access in frontend code; no raw SQL in services; no
publication rules inside Svelte components.

---

## Development setup

Use **Node.js 24** and **pnpm 10.15.0**:

```sh
pnpm install --frozen-lockfile
```

Fallback: `npx --yes pnpm@10.15.0 install --frozen-lockfile`.
Follow [Development](docs/DEVELOPMENT.md) for PostgreSQL, environment,
migrations, admin bootstrap, and the two development servers.
Use disposable data when changing storage, migrations, or delete behavior.

---

## Proposing work

- Search existing issues and [TODO.md](TODO.md) before proposing a feature.
- For bugs, provide minimal sanitized reproduction steps and expected/actual
  behavior; use the bug template.
- For features, explain the user problem, scope, and what remains deferred.
- For authoring/import failures, include a small **nonprivate** TOML/Markdown
  sample, not an entire personal vault.
- Report exploitable issues privately under [SECURITY.md](SECURITY.md).

Do not present a baseline schema as a completed user feature. In particular,
revision groundwork does not mean history/restore, and deferred comments,
reactions, email delivery, or collaboration are not shipped.

---

## Adding an API use case

1. Define/validate the untrusted payload with Zod at the boundary.
2. Put business rules in the appropriate service.
3. Extend database-free repository contracts only when necessary.
4. Implement persistence in Drizzle and equivalent behavior in memory repos.
5. Keep the HTTP router thin: parse, authorize, delegate, map errors.
6. Update frontend DTO validation and server clients when the contract changes.
7. Add negative tests and update [API](docs/API.md).

Public detail uses slug; mutations/admin detail use UUID. Preserve masked 404
for unpublished posts. Apply visibility to new lists, counts, search, backlinks,
feeds, and exports rather than checking detail alone.

---

## Changing authoring or publishing

- Keep `+++` TOML frontmatter and API camelCase fields explicitly mapped.
- Preserve slug upsert semantics and per-file error reporting.
- Document any import overwrite or migration consequences.
- Distinguish `publishedAt` metadata from `publishAt` scheduling.
- Test future/null timestamps, due processing, and schedule clearing.
- Never render unsanitized Markdown or weaken sanitization for a convenience
  embed without a deliberate security design.

---

## Changing media storage

Routes/services depend on `StorageProvider`, not backend classes or SQL.
Test save/load/remove behavior and identical rejection of invalid keys/types/
sizes across local and database providers.

Document persistence and backup requirements. A new provider selector is not
object migration tooling. Never imply draft media becomes private unless an
actual authorization model is implemented.

---

## Database migrations

```sh
pnpm db:generate
```

Inspect and commit generated SQL plus associated metadata with the schema
change. Generation is offline-safe; application requires a database.
Test migrations against a disposable PostgreSQL 17 instance and explain
compatibility/rollback impact. Do not rely on unit tests to validate generated
columns, GIN indexes, or database blobs.

---

## Themes and accessibility

Use CSS tokens in `frontend/src/app.css`; preserve light/dark/OLED and the
`site-theme` preference. Reuse record/stamp/table/document-shell patterns.
Keep theme state presentation-only in `lib/theme.ts`.

Test keyboard navigation, labeled controls, visible focus, contrast, narrow
viewports, and meaningful alt text. Verify CSP still permits the intended theme
bootstrap and normal SvelteKit assets without disabling protections broadly.

---

## Conventions — must follow

- **Tabs** for code indentation; never spaces.
- **Single quotes** for strings; semicolons required.
- Every code file starts with `@file` and `@brief`.
- Every function has TSDoc with `@brief`, `@param`, and `@return`.
- Feature modules stay **under 400 lines**; functions **under 50 lines**.
- Avoid conditionals nested deeper than three levels; prefer guard clauses.
- All comments, documentation, and commit messages are **English**.
- Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, etc.
- Avoid redundant comments narrating obvious syntax.
- Pin dependency versions; do not introduce `latest` or caret ranges.
- Never commit secrets, `.env`, uploads, database dumps, or private drafts.

SvelteKit 3 uses `vite.config.ts`, `$app/tsconfig`, relative imports,
`@sveltejs/kit/hooks` for `Handle`, and server-only `process.env`.
Do not reintroduce incompatible legacy configuration.

---

## License

BenchCore is licensed under the **GNU Affero General Public License v3.0
or later (AGPL-3.0-or-later)** — see [LICENSE](LICENSE). By contributing,
you agree that incoming contributions are governed by the same license.

---

## Development and testing checklist

- [ ] API typecheck: `pnpm --filter benchcore-api exec tsc --noEmit`.
- [ ] Frontend check: `pnpm check`.
- [ ] Tests: `pnpm test`.
- [ ] Lint: `pnpm lint`.
- [ ] Build: `pnpm build`.
- [ ] Add regression tests for changed rules and failure paths.
- [ ] PostgreSQL smoke test for migrations/search/blob persistence.
- [ ] Manual UI, Origin/cookie, scheduling, media, and theme checks as relevant.
- [ ] Update user/developer/operations docs for changed behavior.
- [ ] Review diff and remove accidental generated/private files.

See [Testing](docs/TESTING.md) for the complete matrix.
If a check cannot run, report the concrete reason; do not mark it passed.

---

## Submitting pull requests

1. Branch from `main`: `git switch -c fix/descriptive-name`.
2. Keep the change focused and include tests/docs with behavior changes.
3. Use the configured Git identity and Conventional Commits.
4. Review your staged diff before committing.
5. Push your branch and open a PR targeting `main`.
6. Explain the entire branch's purpose, testing, migrations, security impact,
   and known limitations using the PR template.

Release/version updates are local repository operations unless an explicit
publication is requested. Do not publish a package, tag, or GitHub release
merely because a manifest version changed.
