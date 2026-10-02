<!-- @file docs/OPERATIONS.md -->
<!-- @brief Deployment, migration, backup, recovery, and operational checks. -->

# Operations

For **0.6.0-beta.1 single-origin Node deployment**, use
[Beta deployment](BETA_DEPLOYMENT.md). The split API/frontend Docker instructions
below remain an alternative, not the GitHub delivery artifact.

## Deployment model

The frontend and API are Node services; this is not a frontend-only static
deployment. PostgreSQL holds runtime content/users/sessions; local media
requires durable filesystem storage unless `MEDIA_STORAGE=database`.

Use the committed Dockerfiles and Compose file as the reference stack:

```sh
docker compose up --build
docker compose ps
```

The default topology is PostgreSQL 17, API `:5181`, frontend `:5180`, and
named volumes `pgdata`/`mediadata`. Review actual published ports before
exposing a host. Development defaults are not production credentials.

## Production checklist

- [ ] Set strong, unique database and admin credentials outside Git.
- [ ] Configure HTTPS at a reverse proxy; redirect public HTTP to HTTPS.
- [ ] Set `PUBLIC_SITE_URL` and `SITE_URL` to the external canonical origin.
- [ ] Add only necessary exact origins to `API_ALLOWED_ORIGINS`.
- [ ] Keep `PUBLIC_API_URL` reachable from the frontend server; an internal
  URL such as `http://api:5181` is not the public canonical site URL.
- [ ] Route `/api/media/*` to the API for relative image URLs.
- [ ] Run production processes with `NODE_ENV=production`.
- [ ] Do not expose PostgreSQL publicly; restrict direct API access as needed.
- [ ] Apply reviewed migrations before serving code that needs them.
- [ ] Bootstrap the admin intentionally; Compose startup is not admin creation.
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
Built runtime images need not include every development/bootstrap tool:
do not assume `docker compose exec api pnpm seed` is supported.

`SITE_URL`/allowed origins describe the browser-facing site. They should not
be derived from untrusted Host or forwarded headers. A proxy changing the
upstream transport URL does not justify widening the Origin allowlist.

Start production frontend builds with `pnpm --filter benchcore-frontend start`,
or `node frontend/server.mjs` from the root, not the generated `build/index.js`.
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
The API container performs migrate-on-boot; explicit staging verification
is still required. Avoid concurrent deployment processes racing migrations.

Upgrade procedure:

1. Record the current commit/image and storage configuration.
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

### PostgreSQL dump through Compose

Run from the repository root. The database credentials are used inside the
container without printing them:

```powershell
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/blog-backup.dump'
$dbContainer = docker compose ps -q db
docker cp "${dbContainer}:/tmp/blog-backup.dump" ".\blog-backup.dump"
```

A custom-format dump is binary. PowerShell 5.1 text redirection can corrupt
binary output, so do not replace this with `pg_dump ... > backup.dump`.
Check each command's exit status and move the dump to protected backup storage.
Never commit it or attach it to an issue.

### Local-media archive through Compose

Quiesce editorial writes, uploads, and scheduled publication for a coherent
database/media backup point. Then archive the **complete** media directory:

```powershell
docker compose exec -T api tar -czf /tmp/media-backup.tar.gz -C /data/media .
$apiContainer = docker compose ps -q api
docker cp "${apiContainer}:/tmp/media-backup.tar.gz" ".\media-backup.tar.gz"
```

This example assumes the Compose `MEDIA_DIR=/data/media`. Substitute your
actual mount path if changed. Quiescing must leave the container available
for `exec`, or use an approved offline volume-backup procedure instead.
PostgreSQL dumps are transactionally consistent; coordinating external media
with that snapshot is an operator responsibility.

## Restore drill

Restore into a **new isolated database and media location**, never directly
over the only live copy. The following database name is dedicated test state:

```powershell
$dbContainer = docker compose ps -q db
docker cp ".\blog-backup.dump" "${dbContainer}:/tmp/blog-backup.dump"
docker compose exec -T db sh -c 'createdb -U "$POSTGRES_USER" blog_restore_test'
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d blog_restore_test --no-owner --no-acl /tmp/blog-backup.dump'
```

Ensure `blog_restore_test` is a fresh disposable target. If it already exists,
stop and inspect rather than dropping it blindly. Test with application code
matching the dump's schema, then evaluate any needed migrations.

For local media, extract the archive into a new empty staging mount; preserve
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

`GET /health` reports the API service. Test a real database-backed read and
media retrieval as separate readiness checks. Monitor HTTP errors,
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

`docker compose down` preserves named volumes. **`docker compose down -v`
removes them and can destroy database/media state.** Never use it as a
routine troubleshooting step on valuable data.

Content import and seed can overwrite runtime posts. Storage-mode changes can
make old images appear missing. Treat both as data operations requiring a
reviewed plan, not harmless deploy commands.
