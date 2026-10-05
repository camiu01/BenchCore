<!-- @file BETA_DEPLOYMENT.md -->
<!-- @brief Single-origin Node beta delivery, installation, account safety and recovery. -->
# BenchCore beta deployment

**Bench-testing, Embedded Networks, & Circuit Hacks: Centralized Open-source Research Engine**

Version **0.6.0-beta.1** delivers the frontend and API as one Node.js service.
Public pages and `/api/*` share one origin and port, **5180** by default.
Only a random loopback port is used internally for SSR calls. No second public
API port, container registry or container image is needed.

**GitHub Pages cannot run this application.** The delivery artifact requires
a Node.js 24 Linux x64 host and PostgreSQL 17. GitHub stores source, CI results,
artifacts and optional beta prereleases, not the running PostgreSQL application.

## GitHub delivery

- `ci.yml`: pull requests and feature branches run typechecks, tests, lint and
  builds. A separate ephemeral PostgreSQL job applies every migration and tests
  the unified production server. It never uses the configured private database.
- `cd.yml`: pushes to `main` and manual runs reuse CI, build both packages,
  assemble production-only dependencies, test the actual bundle, then upload
  a Linux x64 `.tar.gz` and `SHA256SUMS` as an Actions artifact (30-day retention).
- A matching tag such as `v0.6.0-beta.1` additionally publishes a **prerelease**
  after the `beta-release` environment gate. Configure required reviewers in
  repository settings before tagging. Publishing permission exists only in
  that job; PR jobs cannot publish.
- There is no automatic server deployment, GHCR upload, database migration on
  the real host or generated production secret. Configure those separately
  when hosting is selected. Merely adding these files does not run them.

### Download the artifact

After the workflow files are committed and pushed, open **Actions → CD → Run
workflow** on `main`, or let a push to `main` start delivery automatically.
When the run succeeds, use the download link in the bundle job's summary or
the run's **Artifacts** section. The artifact name includes the beta version,
`linux-x64`, run ID and attempt, so reruns do not collide or replace earlier
artifacts. It contains `benchcore-<version>-linux-x64.tar.gz` and `SHA256SUMS`.
GitHub wraps the artifact download in a ZIP: unzip that wrapper first, then
verify the checksum and extract the inner archive. Downloads require access
to the repository and are retained for 30 days; tagged prerelease assets are
the longer-lived delivery path.

Review the complete working tree before pushing. Tags and hosted releases
remain separate, explicitly authorized publication actions.

## Build from source

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm lint
pnpm build
pnpm beta:package
```

The directory `artifacts/benchcore-0.6.0-beta.1` is allowlisted: compiled API,
frontend build, runtime, migrations, production dependencies, license,
changelog and this guide. It excludes `.env`, authoring content, uploaded media,
preview accounts, screenshots, `.git`, tests and development dependencies.
Existing version directories are not overwritten. Local bundles match the
build machine's platform; only the GitHub Ubuntu bundle is delivered as Linux x64.
Windows local bundles use junctions and must stay in their generated location.
They are assembled in an exclusively reserved final directory rather than moved.
The Linux CD artifact uses relocatable relative dependency links.
Dependency deployment stages inside `artifacts/` in an isolated metadata-only
workspace, containing legacy pnpm bin-link resolution within writable staging.
Unique staging directories are removed after packaging; existing release
directories are never overwritten.

## Install

1. Download the two release assets or the CD Actions artifact.
2. Run `sha256sum --check SHA256SUMS`, then extract the archive.
3. Run as a dedicated unprivileged service user. Use the packaged dependencies;
   no source compilation, pnpm or `npm install` is needed on the host.
4. Copy `.env.production.example` to `.env`; protect it with `chmod 600`.
   Configure the real HTTPS `SITE_URL`, PostgreSQL URL (with certificate-verified
   TLS for remote databases), port and persistent absolute `MEDIA_DIR`.
   Alternatively set `MEDIA_STORAGE=database` to include images in DB backups.
5. Back up existing state, then run `npm run db:migrate` explicitly. Startup
   does not migrate, create users, reset passwords or import content.
6. Run `npm start` behind a TLS reverse proxy. Bind `HOST=127.0.0.1` on a VPS;
   managed hosts may require `HOST=0.0.0.0` and their assigned `PORT`.

From the source checkout the equivalent migration command is
`pnpm beta:migrate`; `pnpm start` launches the same single-port runtime.
Existing `.env` values are preserved. Production uses `SITE_URL` as its sole
trusted browser origin and overrides any stale `PUBLIC_API_URL` internally.

### Reverse proxy

Example Caddy configuration (replace the domain):

```caddy
blog.example.com {
    reverse_proxy 127.0.0.1:5180 {
        header_up X-Forwarded-For {remote_host}
    }
}
```

Trust only exact immediate proxy IPs using `TRUSTED_PROXY_IPS`. The proxy must
overwrite, not append, `X-Forwarded-For`. Client-supplied bridge/host/protocol
headers cannot select an upstream, origin or another user's rate-limit bucket.
The frontend SSR bridge preserves each visitor's quota identity.
When no proxy is trusted, direct-peer limits are safe but shared behind a proxy.
Apply network-layer connection limits at the host/proxy as well.

### Service example

```ini
[Unit]
Description=Personal publishing beta
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=publishing
WorkingDirectory=/opt/publishing/current
ExecStart=/usr/bin/node --env-file=/etc/publishing.env runtime/server.mjs
Restart=on-failure
RestartSec=5
TimeoutStopSec=20
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/publishing
UMask=0077

[Install]
WantedBy=multi-user.target
```

Create the service user and owned media directory separately. Keep code
read-only and state outside the versioned application directory.
`SIGTERM`/`SIGINT` drain requests, stop publication scheduling and close the pool,
with a 15-second deadline.

## Accounts

- `/register`: public registration creates **readers only**. Readers cannot
  publish, upload, access drafts or administer accounts.
- `/account`: change your own password with the current password. New passwords
  require 12+ characters; a successful change revokes **all** existing sessions.
- `/admin/users`: administrators list/create accounts, change reader/admin roles
  and disable/reactivate users. Changes revoke sessions. The final active
  administrator cannot be disabled or demoted, including concurrent requests.
  Accounts are disabled rather than deleted to retain authorship.
- First administrator: privately supply JSON stdin to `npm run user:create`
  (source: `pnpm beta:user:create`). Fields: `username`, `password`, optionally
  `email` and `name`. Existing identities are preserved.
- Operator recovery: explicitly pipe private JSON containing `username` and a
  12+ character `password` to `npm run user:password` (source: `pnpm user:password`).
  This rotates only that existing account and revokes its sessions. Never put
  passwords in shell arguments, committed files, workflow inputs or logs.

Existing development passwords are **not** rotated automatically. Sign in and
change them before exposing the beta. The account migration preserves existing
roles and valid pre-migration sessions; it rejects duplicate case-folded emails
instead of merging identities. Resolve collisions before retrying migrations.

This beta has **no email verification, CAPTCHA, MFA or account deletion
workflow**. Password-reset delivery is available when Resend is configured.
Email remains a login identifier, not proof of
mailbox ownership. Add perimeter abuse protection if public registration attracts
spam. Never rely on in-memory quotas as distributed multi-instance enforcement.

## Health, backup and rollback

- `/health` and `/health/live`: process liveness, no DB access.
- `/health/ready`: connectivity and migrated runtime columns, 503 on failure;
  coalesced checks with a two-second cache, no secret/error details.
- Monitor readiness externally; use PostgreSQL and persistent-media backups.
  Test a restore before treating the beta as a production-critical archive.
- Back up before migrations. Keep the previous release directory and its
  checksum. Code rollback uses the old directory; schema downgrade is **not**
  automatic. Restore a verified backup if a migration is incompatible.
- Never delete database or media state as a rollback mechanism.

## Release checklist

- [ ] CI and CD run green on GitHub, including PostgreSQL and bundle smoke tests.
- [ ] HTTPS domain, trusted proxy and database TLS configured.
- [ ] Every development administrator password rotated.
- [ ] Persistent storage, backup/restore and monitoring verified on the host.
- [ ] `beta-release` reviewers and main-branch protection configured in GitHub.
- [ ] Registration abuse controls and documented beta limitations accepted.
