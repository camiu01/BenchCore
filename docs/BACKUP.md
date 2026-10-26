<!-- @file BACKUP.md -->
<!-- @brief Private offline backup format, empty-target recovery and isolated PostgreSQL drill. -->

# Backup and recovery

The `backup` CLI exports the **entire PostgreSQL database** and completed managed
images through the configured storage provider. Content import is not recovery.
This tooling has isolated unit/protocol tests. A successful real PostgreSQL
recovery drill is still required before the 0.9.0 release.

## Preconditions

- Use PostgreSQL 17 `pg_dump` and `pg_restore` on `PATH`. The CLI never installs
  clients, creates databases, migrates, drops objects or switches live traffic.
- Stop **all** writers for the entire export/restore: every application instance,
  scheduler, newsletter batch, importer, cleanup process and direct R2 upload.
  Block browser PUTs and let outstanding 120-second upload tickets expire.
  `--maintenance` acknowledges this work; it does not perform it.
- Use a protected absolute backup path outside the checkout, `MEDIA_DIR`, web
  roots and deployment artifacts. Its parent must exist. Export requires a
  **new** directory; there is no overwrite, clean or force option.
- Keep backups and their parent directories inaccessible to other users.
  New directories/files use modes `0700`/`0600` and the CLI uses umask `077`;
  Windows users must additionally configure appropriate NTFS ACLs.
- Use the same application artifact, migration version and storage backend for
  recovery. Backend migration is not part of this command.

From a source checkout, `pnpm backup` delegates to the API package, so relative
paths/default local media resolve under `api/`. Use **absolute** paths, including
`MEDIA_DIR`. Built checkout: `pnpm backup:production`. Packaged artifact:
`npm run backup --`. The artifact includes the compiled CLI, not client binaries.

## Export and verify

Load source credentials privately as `DATABASE_URL`, plus `MEDIA_STORAGE` and the
normal provider settings. Never pass a connection URL or password as an argument.
For example, with your protected environment already loaded:

```sh
pnpm backup export --directory /protected/backups/benchcore-snapshot --maintenance
pnpm backup verify --directory /protected/backups/benchcore-snapshot
```

Export uses a native custom-format dump with all application schemas/data,
including users/password hashes, sessions, recovery tokens, TOTP ciphertext and
replay state, audit events, posts, tags/relationships, moderation, engagement,
subscribers, newsletter claims, groundwork tables, migration history, generated
columns, indexes and constraints. Database-mode blobs are in the dump **and**
the independently checksummed managed-image inventory.

Local sidecars are reconstructed from the manifest during recovery. R2 private
object indirection may change; public keys and bytes remain identical. Completed
media with no current post reference are still included. Unpublished staging
uploads and orphan R2 bytes without published metadata are not application state
and are not included. Invalid/unreadable published metadata fails the export,
rather than producing a silently incomplete success.

Native clients receive credentials through a restricted child environment, not
arguments. TCP PostgreSQL URLs support `sslmode`, `sslrootcert=system`, `connect_timeout`,
`application_name` and `target_session_attrs`; other query options are rejected.
Provide database credentials in the privately loaded URL when authentication is
required, not inherited `PGPASSWORD`/password-file fallbacks. Certificate-file
and client-certificate URL options are not supported by this coordinated CLI.
Use certificate-verified TLS for remote databases.
Native diagnostic output is deliberately not logged.

### Format `benchcore-backup-v1`

```text
snapshot/
  manifest.json
  database.dump
  media/
    <original-managed-key>
```

The manifest records the application version, timestamp, storage backend,
database byte length/SHA-256 and every media key, filename, MIME, byte length and
SHA-256. Images retain the existing 5 MiB limit; the bounded manifest supports
up to 100,000 images and 64 MiB of metadata. Dumps are hashed as streams.

Only a final manifest marks a completed export. Failed exports leave an
incomplete directory for operator inspection, never automatic deletion or reuse.
Verification checks exact inventory, plain files, lengths, hashes and format.
It does **not** prove database recoverability or authenticate backup provenance.
A malicious archive can have matching hashes and execute SQL during restore.

The format is **not encrypted or signed**. Encrypt the whole directory with
approved backup tooling, retain a protected off-host copy and enforce retention.
Do not upload it to CI, issues, releases or public storage.

## Empty-target recovery

1. Provision a **new empty isolated database** and a new empty local directory
   or private R2 managed namespace. Do not migrate the target first. Do not use
   the live database or the only surviving media store.
2. Load **target** connection details privately as `RESTORE_DATABASE_URL`.
   Restore never falls back to `DATABASE_URL`. Select target `MEDIA_DIR` or
   R2 location explicitly using **`RESTORE_MEDIA_DIR`** (required absolute path
   for local storage) or **`RESTORE_R2_BUCKET`** (required for R2). Normal
   `MEDIA_DIR`/`R2_BUCKET` values are never inherited as restore destinations.
   Configure target R2 account/credentials through the normal private R2 settings.
   Preserve source configuration separately.
3. Verify and restore using the matching artifact:

   ```sh
   pnpm backup restore --directory /protected/backups/benchcore-snapshot --maintenance --trust-backup
   ```

4. All archive checks run before target writes. Non-system schemas, relations,
   routines/types or existing managed media cause refusal. External media use
   exclusive/conditional writes. The database restore rechecks emptiness and uses
   `--single-transaction --exit-on-error --no-owner --no-privileges`, never
   `--clean`/drop. Deploy roles/grants are managed separately, not restored from
   the source cluster. Run with only the required recovery privileges.
5. Every restored image key, metadata record and byte checksum is checked.
   Database mode restores blobs through PostgreSQL, never new generated keys.
6. Start only against the isolated target. Verify login and private masking,
   row counts/relationships, tags, search/backlinks, schedules, images and feeds
   before considering a separately reviewed production cutover.

There is no transaction across PostgreSQL and external storage. External images
are imported **before** the atomic DB restore; a later failure can leave isolated
partial media. Do not start that target or retry with overwrite flags. Preserve
the backup, inspect privately and prepare a fresh empty target. The CLI does not
delete partial data, existing files, databases or buckets on failure.

Backups contain sensitive drafts, email addresses, password/session/token hashes
and potentially still-valid sessions. Preserve `AUTH_TOTP_KEY` separately to
decrypt restored factors and `NEWSLETTER_TOKEN_KEY` to preserve delivered
unsubscribe links. `.env`, database credentials, SMTP/R2 credentials, cluster
roles/grants and deployed code are **not** included. Preserve their protected
references and the exact artifact separately. After an incident, deliberately
revoke sessions/tokens before reopening access. Keep mail delivery disabled
during the drill to prevent duplicate or accidental messages.

## Reproducible real PostgreSQL drill

Provision three **empty loopback-only** PostgreSQL 17 databases with distinct
names ending in `_test`. Do not reuse the application's current database.
Privately configure:

- `BACKUP_TEST_SOURCE_URL`
- `BACKUP_TEST_LOCAL_URL`
- `BACKUP_TEST_DATABASE_URL`

Then run, without loading production environment files:

```sh
pnpm --filter benchcore-api exec vitest run tests/backup-postgres.test.ts
```

The test refuses non-loopback/non-`*_test`/populated databases, applies migrations
only to the empty source, populates every application table and verifies complete
row equality, generated vectors, migration history and media after native restore
into both targets. It leaves all three test databases intact for inspection;
only its own temporary backup/media files are removed.

Without these variables the drill is explicitly **skipped**, not passed.
The operator deferred this real recovery test; no PostgreSQL installation or
isolated cluster was created during this work.
This host currently lacks PostgreSQL clients on `PATH`; no real recovery result
is claimed. Offline R2 protocol tests are not a hosted R2 recovery result.
Record the actual drill command, client/server versions, result, elapsed time,
counts and isolated application smoke results in the release evidence. Never
record connection strings, hashes, private rows or factor material.
