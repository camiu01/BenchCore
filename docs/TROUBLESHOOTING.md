<!-- @file docs/TROUBLESHOOTING.md -->
<!-- @brief Diagnose common local, editorial, security, and deployment failures. -->

# Troubleshooting

## First checks

Record the commit, Node/pnpm versions, command, environment **variable names**
involved, and sanitized error. Never print the full process environment: it can
contain unrelated credentials.

```sh
node --version
pnpm --version
```

Check API `/health`, then a database-backed request. Review API/frontend logs
without publishing request bodies, passwords, cookies, or connection strings.

## Install or build fails

- Use Node.js 24 and pnpm 10.15.0.
- If `pnpm` is missing, use `npx --yes pnpm@10.15.0`.
- Run install from the workspace root with the committed lockfile.
- Do not bypass a frozen-lockfile mismatch; reconcile manifest/lockfile changes.
- Run frontend and API typechecks separately to identify the failing package.
- SvelteKit 3 config belongs in `vite.config.ts`, not `svelte.config.js`.
- Do not add legacy aliases or `$env` imports to solve a server-only setup issue.

## Beta packaging fails with `/home/tmp` EACCES

The legacy pnpm deployment must stage under the writable checkout's
`artifacts/` directory and run inside its isolated dependency workspace. Use the
updated packaging script rather than granting access to `/home` or running
pnpm as root. Existing versioned artifacts are intentionally not overwritten.

## Database connection or migration failure

- Verify `DATABASE_URL` is in the **current process environment**.
- Check hostname/port from the process making the connection. `localhost`
  refers to the machine running the Node service, not a remote database host.
- Ensure PostgreSQL is ready and the user/database exist.
- Verify committed migrations were applied before testing new search/schedule/
  database-media behavior.
- Stop on a migration error; do not manually mark it applied or delete data.

## Login fails or cookie disappears

- Seed the intended database with the intended email.
- Existing users are not password-reset by `pnpm seed`.
- Production Secure cookies require HTTPS at the browser-facing origin.
- Check that SvelteKit forwards API Set-Cookie and subsequent session cookies.
- Check expiry, server clock, and whether a database restore invalidated or
  unexpectedly resurrected sessions.
- A successful `/health` response does not prove session-table access works.

For password recovery failures, verify `RESEND_API_KEY`,
`PASSWORD_RESET_FROM`, and `SITE_URL`. The request intentionally returns the
same result for existing and unknown accounts, so inspect the Resend delivery
status without logging reset URLs or tokens. Do not repeatedly re-seed.

## Mutation returns 403

Check `Origin`, `SITE_URL`, and `API_ALLOWED_ORIGINS`. Origins match exactly:
scheme, hostname, and port. `localhost` and `127.0.0.1` are not interchangeable.

For local frontend use `http://localhost:5173`; for a local unified preview
use `http://localhost:5180`. Production uses the configured HTTPS site origin.
Server actions must forward that trusted external origin.

Direct clients must send a trusted Origin. Do not fix the error with a wildcard
or an allowlist populated from arbitrary request headers.

## Mutation returns 401 or 429

401 means missing/invalid authentication, not an Origin configuration problem.
Log in and retain the returned cookie safely.

429 means rate-limited. Back off and inspect `Retry-After` when present.
Rate state is per-process and in memory; restarting merely resets the counter,
not the underlying cause. Shared proxy/NAT traffic can affect observed limits.

## Post missing from public pages

Inspect status, `publishedAt`, `publishAt`, and timezone. Draft/archived/
future posts should be absent; masked 404 is intentional.

For a scheduled draft, ensure the API process is running, the schedule is due,
the job has had a subsequent minute tick, and the clock is correct.
Check the admin record, not only an old cached browser tab.

Backlinks only include public source posts. An unpublished referencing note
must not appear as a backlink.

## Search misses expected content

- Apply the search-vector/GIN migration.
- Test a real PostgreSQL repository, not just a memory test double.
- Search is full-text, not arbitrary substring or fuzzy spelling matching.
- `simple` does not perform language-specific stemming.
- Confirm the post is public and optional tag filters match.
- URL-encode the query and reset pagination offset after changing filters.

## Import fails or overwrites an edit

- Use `+++` fences and valid TOML; quote ISO timestamps.
- Check required title/slug and supported field bounds.
- Import reads direct `.md` children, not an entire nested Obsidian vault.
- Duplicate slugs are not separate post identities.
- A nonzero exit can coexist with successfully imported files.
- Re-import is an upsert; it can overwrite later admin changes.
- Removing a source file is not a database delete.

Recover valuable edits from a known source/backup. Revision schema groundwork
does not imply an available history/restore feature.

## Images upload but do not display

- Use the returned `/api/media/<key>` URL.
- Route that path to the API at the browser-facing origin.
- Check provider selection; changing modes does not migrate old files.
- Local mode requires both image bytes and JSON sidecar in `MEDIA_DIR`.
- Verify persistent paths, permissions, and available disk space.
- Database mode requires its tables/migrations and accessible blobs.
- Check CSP and browser network errors without disabling all security headers.

PNG/JPEG/WebP/GIF only, decoded maximum 5 MiB. Base64 transport is larger than
the source file; regular JSON and media body caps differ.

## Theme flash or hydration failure

Check localStorage `site-theme`, root `data-theme`, and the pre-paint script.
Verify production CSP allows the application's intended bootstrap and assets.
Check all three themes, not only the developer's selected mode.
Do not introduce broad `unsafe-eval` or disable CSP as a generic workaround.

## Reporting a problem

Use the issue templates with sanitized steps, expected/actual behavior,
runtime/browser versions, route/method/status, and storage/deployment mode.
Report exploitable vulnerabilities privately under [SECURITY.md](../SECURITY.md).
Never attach raw `.env`, backups, private draft bodies, or session cookies.
