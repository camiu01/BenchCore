<!-- @file docs/OPERATIONS.md -->
<!-- @brief Deployment, migration, backup, recovery, and operational checks. -->

# Operations

For **0.7.0 single-origin Node deployment**, use
[Node deployment](BETA_DEPLOYMENT.md). The supported deployment is the
production-only Node artifact, with a separately managed PostgreSQL database.
For full-app serverless hosting, use [Vercel and private R2](VERCEL_DEPLOYMENT.md);
its scheduler is temporarily disabled.

## Deployment model

The frontend and API share one Node service; this is not a frontend-only static
deployment. PostgreSQL holds runtime content/users/sessions; local media
requires durable filesystem storage unless `MEDIA_STORAGE=database` or `r2`.

From a reviewed source checkout:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm beta:migrate
pnpm start
```

Configure `.env` before applying migrations. The default topology is a single
Node listener on `:5180` and PostgreSQL 17 on a restricted database endpoint.
Persist `MEDIA_DIR` when using local media. Development defaults are not
production credentials. The packaged artifact needs no source build or pnpm.

## Production checklist

- [ ] Set strong, unique database and admin credentials outside Git.
- [ ] Configure HTTPS at a reverse proxy; redirect public HTTP to HTTPS.
- [ ] Set `SITE_URL` to the external canonical origin.
- [ ] Add only necessary exact origins to `API_ALLOWED_ORIGINS`.
- [ ] Proxy pages, `/api/*` and health probes to the same Node listener.
- [ ] Configure only the immediate proxy addresses in `TRUSTED_PROXY_IPS`.
- [ ] Run production processes with `NODE_ENV=production`.
- [ ] Do not expose PostgreSQL publicly.
- [ ] Apply reviewed migrations before serving code that needs them.
- [ ] Bootstrap the admin intentionally; startup is not admin creation.
- [ ] Select and persist media storage; test image retrieval after restart.
- [ ] Verify Origin rejection, rate limits, security headers, and frontend CSP.
- [ ] Back up, test restore, and monitor failures/storage growth.

Prefer least-privilege runtime database access and a separately controlled
migration operation when your hosting model permits it. Do not use a
development database owner credential as a universal production credential.

## Bootstrap and configuration

`pnpm user:create` accepts a single JSON object on standard input. It creates a
database account without storing `ADMIN_*` variables in `.env`, resetting
existing users, or importing posts:

```powershell
$username = Read-Host 'New username'
$name = Read-Host 'Display name'
$securePassword = Read-Host 'New password' -AsSecureString
$password = [System.Net.NetworkCredential]::new('', $securePassword).Password
@{ username = $username; name = $name; password = $password } |
	ConvertTo-Json -Compress |
	pnpm user:create
Remove-Variable password, securePassword
```

Use a strong password for exposed installations. Usernames are stored
case-insensitively; email is optional for this CLI and defaults to a reserved
`.invalid` address. Existing username/email matches are left unchanged.

`pnpm seed` requires database/admin variables and imports content as well as
creating the initial user. Existing email addresses are left intact; seed
does not reset passwords.

Run bootstrap from a trusted checkout with network access to the deployed
database and the intended authoring files. Avoid placing passwords in CLI
arguments or copying local example credentials into production.
The packaged artifact provides `npm run user:create` for account provisioning.
Authoring imports and seed remain source-checkout operations, not startup tasks.

`SITE_URL`/allowed origins describe the browser-facing site. They should not
be derived from untrusted Host or forwarded headers. A proxy changing the
upstream transport URL does not justify widening the Origin allowlist.

Start the unified production service with `pnpm start` from a source checkout,
or `npm start` from the artifact, not the generated frontend `build/index.js`.
The bootstrap overwrites its private adapter host/protocol headers with the
configured canonical origin and defaults `BODY_SIZE_LIMIT` to `8M`.
This supports HTTP localhost previews and HTTPS deployments without trusting
client-supplied forwarded headers or rebuilding for a different origin.

## Migrations and upgrades

```sh
pnpm db:generate
pnpm db:migrate
```

Generate during development, inspect the SQL and migration metadata, and
commit them together. Applying migrations needs `DATABASE_URL`.
The unified service does not migrate on startup. Use `pnpm beta:migrate` from
the built checkout or `npm run db:migrate` from the artifact before startup.
Avoid concurrent deployment processes racing migrations.

Upgrade procedure:

1. Record the current commit/artifact and storage configuration.
2. Verify a recent backup and prepare a maintenance window if needed.
3. Build/test the candidate against a disposable or staging database.
4. Review migration compatibility and expected lock duration.
5. Apply/deploy, then test health, login, public reads, search, scheduled
   publishing, and image retrieval.
6. Monitor errors before considering the upgrade complete.

Generated search vectors/GIN indexes, blob tables, and scheduling fields
require their migrations; a successful TypeScript build does not create them.

Rollback is not automatically `git checkout` plus restart: older code may not
understand the migrated schema. Restore into an isolated database or use a
reviewed compatibility plan. Do not invent destructive down migrations.

## Media selection

| Mode | Durable state | Backup consequence |
|---|---|---|
| `local` | `MEDIA_DIR`, image bytes and JSON sidecars | Back up database **and** the complete media directory |
| `database` | PostgreSQL media/blob tables | Include blobs in database dumps; monitor DB/backup growth |

Changing modes alone does not transfer objects. Test a deliberate copy/verify
procedure or keep using the existing provider until migration tooling exists.
Never delete the old store solely because the new provider starts successfully.

## Backup

Back up runtime data, not just Git:

- PostgreSQL: posts, source/rendered content, tags, users, sessions, schedules,
  and database-mode media.
- Local-mode media: image files **and sidecars**.
- Deployment configuration/secret references, protected separately.
- Authoring source and the deployed code/migration version.

Protect backups as sensitive data: drafts, emails, hashes, and session hashes
remain private even when public posts are readable. Encrypt, restrict access,
set retention, and keep an off-host copy. Define acceptable recovery point
and recovery time for your own deployment.

### PostgreSQL dump

Use PostgreSQL 17 client tools with a protected libpq service definition named
`benchcore`, plus a protected password file. Configure its host, port, database
and TLS verification outside Git. Never put credentials in command arguments:

```powershell
pg_dump --dbname=service=benchcore --format=custom --file=benchcore-backup.dump
```

A custom-format dump is binary. PowerShell 5.1 text redirection can corrupt
binary output, so do not replace this with `pg_dump ... > backup.dump`.
Check each command's exit status and move the dump to protected backup storage.
Never commit it or attach it to an issue.

### Local-media archive

Quiesce editorial writes, uploads, and scheduled publication for a coherent
database/media backup point. Then archive the **complete** media directory:

```powershell
tar -czf media-backup.tar.gz -C /absolute/path/to/media .
```

Substitute the actual persistent `MEDIA_DIR`. Stop the Node service or use
an approved write-quiescing procedure during the coordinated backup.
PostgreSQL dumps are transactionally consistent; coordinating external media
with that snapshot is an operator responsibility.

## Restore drill

Restore into a **new isolated database and media location**, never directly
over the only live copy. The following database name is dedicated test state:

```powershell
createdb --maintenance-db=service=benchcore benchcore_restore_test
pg_restore --dbname="service=benchcore dbname=benchcore_restore_test" --no-owner --no-acl benchcore-backup.dump
```

Ensure `benchcore_restore_test` is a fresh disposable target. If it already exists,
stop and inspect rather than dropping it blindly. Test with application code
matching the dump's schema, then evaluate any needed migrations.

For local media, extract the archive into a new empty staging directory; preserve
keys and sidecars. For database media, verify blobs were included in the dump.
Do not switch production traffic until all of these pass:

- Admin login and draft visibility.
- Public counts, detail pages, tags, search, and backlinks.
- Publication timestamps/schedules.
- Image bytes, content types, and complete key references.
- Feeds/canonical URLs.

A full restore can also restore existing sessions. After an incident or
untrusted backup, deliberately invalidate sessions through a reviewed
database/administrative procedure before reopening access.

## Health, logs, and jobs

`GET /health/live` reports process liveness. `GET /health/ready` checks database
connectivity and migrated runtime columns. Also test a real database-backed read
and media retrieval. Monitor HTTP errors,
authentication failures, storage growth, database connectivity, and overdue
scheduled posts.

The due-publication job runs approximately once a minute inside the API
process. Downtime delays processing; it is not a managed queue. Multiple
replicas require reviewed concurrency/idempotency behavior and operational
coordination.

Rate limits are per-process and reset on restart. Put shared traffic controls
at a trusted proxy when needed; do not assume in-memory counters are a
cluster-wide defense. Never trust arbitrary client forwarding headers for
identity without a defined proxy boundary.

The application includes no analytics or third-party trackers. Infrastructure
may log IP addresses, paths, user agents, and timings. Configure retention,
access, and redaction; do not log request bodies, passwords, or Cookie headers.

## Dangerous operations

Deleting the PostgreSQL data directory or persistent `MEDIA_DIR` destroys
runtime state. Never use data deletion as routine troubleshooting or rollback.

Content import and seed can overwrite runtime posts. Storage-mode changes can
make old images appear missing. Treat both as data operations requiring a
reviewed plan, not harmless deploy commands.
