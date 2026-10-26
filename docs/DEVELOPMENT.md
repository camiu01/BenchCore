<!-- @file docs/DEVELOPMENT.md -->
<!-- @brief Reproducible local setup, environment configuration, and commands. -->

# Development

Reproducible local setup behind BENCHCORE. Every command below runs from the
repository root with Node.js 24 and pnpm 10.15.0, and the checks are mirrored
by CI in `.github/`.

## Prerequisites

- Node.js **24**.
- pnpm **10.15.0**, matching `packageManager` in the root manifest.
- PostgreSQL **17**, installed locally or provided by a managed database host.
- Git and a modern browser.

```sh
node --version
pnpm --version
pnpm install --frozen-lockfile
```

Fallback: `npx --yes pnpm@10.15.0 install --frozen-lockfile`. Replace `pnpm`
with that same prefix for subsequent commands when necessary.
Do not silently regenerate the lockfile to hide version or install errors.

## Environment

Copy the reference file:

```powershell
Copy-Item .env.example .env
```

POSIX equivalent: `cp .env.example .env`.

`.env` is private configuration, not a committed source artifact.
API development, migrate, import and
seed/account-creation scripts load the root `.env` through Node's optional
environment-file flag. Vite reads `SITE_URL`, `PUBLIC_SITE_URL`,
`PUBLIC_API_URL`, and `R2_ACCOUNT_ID` from the root environment files.
Exported process variables take precedence.
Production frontend startup uses its own launch environment; copying `.env`
does not export it into your terminal.

### Core settings

All variables below are consumed server-side. URL values can appear in rendered
links; `PUBLIC_` does not make credentials safe to expose. There is no need to
export any database, SMTP, TOTP, or R2 secret to browser code.

| Variable               | Required / default                                                           | Purpose and constraints                                                                                                                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | Required for persistent API and data scripts; no default                     | PostgreSQL connection string. Provision the database separately; use certificate-verified TLS for remote hosts.                                                                                                                                     |
| `RESTORE_DATABASE_URL` | Required only by `backup restore`; no fallback                               | Explicit empty isolated PostgreSQL recovery target. See [Backup](BACKUP.md); never select the live database.                                                                                                                                        |
| `PORT`                 | Optional: standalone API `5181`, unified Node `5180`                         | Listener port. Vite has its own dev-server port; `PORT` does not configure it.                                                                                                                                                                      |
| `HOST`                 | Optional: unified Node `0.0.0.0`; standalone API leaves the host unspecified | Bind address. Set `127.0.0.1` behind a local reverse proxy.                                                                                                                                                                                         |
| `SITE_URL`             | Required explicitly for public hosting                                       | Canonical browser origin, no credentials/path/query. Unified Node falls back to `PUBLIC_SITE_URL`, then local `http://localhost:5180`; production requires an explicit site setting and HTTPS for non-local origins.                                |
| `PUBLIC_SITE_URL`      | Optional fallback for `SITE_URL`                                             | Frontend SEO helper defaults to `http://localhost:5173`; unified Node overrides both site variables with its validated origin.                                                                                                                      |
| `PUBLIC_API_URL`       | Optional: `http://localhost:5181`                                            | Frontend server's standalone API base. Unified Node replaces it with its private loopback address; Vercel uses the service binding instead.                                                                                                         |
| `API_ALLOWED_ORIGINS`  | Optional for standalone API/Vercel                                           | Exact comma-separated origins; precedence over `SITE_URL`, then `PUBLIC_SITE_URL`. Without any setting, development accepts localhost ports 5173/5180/5181; production fails configuration. Unified Node instead permits only its canonical origin. |
| `NODE_ENV`             | Set `production` for deployment                                              | Standalone API/Vercel use it for Secure cookies. Unified Node derives cookie security from its configured HTTPS origin.                                                                                                                             |
| `BODY_SIZE_LIMIT`      | Unified Node defaults to `8M`; set explicitly for standalone adapter-node    | Frontend multipart request cap. It is separate from API JSON/decoded-image limits.                                                                                                                                                                  |
| `TRUSTED_PROXY_IPS`    | Optional, empty trusted set                                                  | Unified Node only: comma-separated exact immediate proxy IPs. Accepts one valid forwarded IP only from a trusted peer; the proxy must overwrite `X-Forwarded-For`.                                                                                  |
| `SCHEDULER_ENABLED`    | Optional: only exact `false` disables the Node timer                         | Approximately minute-based due-draft publication. Vercel installs no timer regardless of this setting.                                                                                                                                              |
| `API_GUEST_CACHE_MS`   | Optional: `15000`, or `0` in test mode                                       | Frontend process-local cookie-less API read cache; nonnegative milliseconds capped at `60000`. Set `0` to disable.                                                                                                                                  |

`API_PORT` in `.env.example` is **unused** by the standalone entrypoint; use
`PORT` instead. `AUTH_SESSION_SECRET` is also unused: sessions are random opaque
tokens authenticated by hash lookup, not signed cookies.

Recovery additionally requires an explicit `RESTORE_MEDIA_DIR` (absolute local
path) or `RESTORE_R2_BUCKET`, according to the selected storage provider.
Existing `MEDIA_DIR`/`R2_BUCKET` values are never restore defaults.
See [Backup](BACKUP.md) before supplying any recovery target.

### Database pooling

Optional server-only API settings, validated in `api/src/db/pool-settings.ts`:

| Variable                         | Default                                     | Accepted values / purpose                                                                   |
| -------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `DATABASE_POOL_MODE`             | Node `session`; Vercel target `transaction` | `session` enables prepared statements; `transaction` disables them for transaction poolers. |
| `DATABASE_POOL_MAX`              | Node `10`; Vercel target `3`                | Integer 1–20, per process/instance, not a deployment-wide limit.                            |
| `DATABASE_POOL_IDLE_SECONDS`     | Node `30`; Vercel target `10`               | Integer 1–600.                                                                              |
| `DATABASE_POOL_LIFETIME_SECONDS` | `300`                                       | Integer 30–3600.                                                                            |

Use a provider-approved migration connection separately when transaction pooling
does not support migrations. The application does not create a pooler or choose
an alternate database endpoint.

### Media, authoring, and account setup

| Variable         | Required / default                             | Purpose and constraints                                                                                                                                                                                   |
| ---------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MEDIA_STORAGE`  | Optional: API `local`, or `r2` when `VERCEL=1` | All production entrypoints accept `local`, `database`, `r2`; local is rejected with `VERCEL=1`.                                                                                                           |
| `MEDIA_DIR`      | Optional: `./data/media`                       | Local backend only; relative to process working directory. `pnpm dev:api` runs inside `api/`, while root `pnpm start` runs at the repository root. Use an absolute path to share persistent media.        |
| `CONTENT_DIR`    | Optional: repository `content/posts`           | TOML import/seed directory. Only direct `.md` children are imported. Relative overrides resolve from the script's working directory (`api/` for root pnpm data scripts).                                  |
| `ADMIN_EMAIL`    | Required only by seed                          | Initial administrator email; existing matches are preserved.                                                                                                                                              |
| `ADMIN_PASSWORD` | Required only by seed                          | Initial administrator password; does not reset existing accounts. Also used with `ADMIN_USERNAME` for optional memory-demo admin creation.                                                                |
| `ADMIN_NAME`     | Optional: `Admin` in seed                      | Initial display name.                                                                                                                                                                                     |
| `ADMIN_USERNAME` | Optional in seed                               | Validated login name; required with a password for the optional memory-demo administrator.                                                                                                                |
| `AUTH_TOTP_KEY`  | Optional, no default                           | 64 hexadecimal characters, independent random 32-byte encryption key. Keep stable across replicas and backed up separately. Missing configuration disables enrollment, never bypasses an existing factor. |

Prefer `pnpm user:create` with private stdin instead of keeping account passwords
in environment files. Seed also imports content and can overwrite database edits.

### Optional email

Standalone API, unified Node and Vercel use `api/src/configured-services.ts`.
Password-reset delivery and explicitly enabled newsletter mail use the same
configuration on all three entrypoints. Constructing services does not send mail.

| Variable               | Required / default                                                 | Purpose and constraints                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `ZOHO_SMTP_USER`       | Optional; required with SMTP password and site origin for recovery | Zoho EU SMTP login, server-only.                                                                                                             |
| `ZOHO_SMTP_PASSWORD`   | Required with SMTP user                                            | Server-only credential/app password. Both SMTP variables absent disables recovery; partial configuration fails startup on wired entrypoints. |
| `PASSWORD_RESET_FROM`  | Optional: SMTP username                                            | Sender address/label; reset links use `SITE_URL`, falling back to `PUBLIC_SITE_URL`.                                                         |
| `NEWSLETTER_ENABLED`   | Optional: disabled unless exactly `true`                           | Explicit activation, independent of recovery configuration.                                                                                  |
| `NEWSLETTER_TOKEN_KEY` | Required when newsletter enabled                                   | Independent server-only secret, at least 32 characters; changing it invalidates previously issued unsubscribe links.                         |
| `NEWSLETTER_FROM`      | Optional: SMTP username                                            | Newsletter sender. Enabling delivery also requires both SMTP credentials and a site URL, HTTPS in production.                                |

SMTP uses authenticated TLS at `smtp.zoho.eu:465`; host/port are not configurable
variables. Remove the example SMTP assignments from a basic local `.env` unless
you intend to configure mail. Placeholder credentials are not a working transport.
See [Newsletter and categories](NEWSLETTER.md) for explicit consent and send limits.

### Vercel and R2

| Variable               | Required / default                          | Purpose and exposure                                                                                                                             |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DEPLOYMENT_TARGET`    | Optional: `vercel` selects that target      | Build/runtime target switch, also selects Vercel pool defaults. Unset for normal Node builds.                                                    |
| `VERCEL`               | Platform-provided `1` on Vercel             | Also selects Vercel behavior; do not rely on local storage there.                                                                                |
| `VERCEL_URL`           | Optional platform deployment hostname       | Validated `<deployment>.vercel.app` hostname; its HTTPS origin is added to the API allowlist. Public hostname, not a credential.                 |
| `API_SERVICE_URL`      | Required Vercel runtime binding; no default | Injected private API base for frontend server calls. Do not set it manually or expose it in browser bundles.                                     |
| `R2_ACCOUNT_ID`        | Required for R2                             | 32 lowercase hexadecimal characters; read by API and frontend build for upload CSP. Account/upload host is intentionally visible to the browser. |
| `R2_BUCKET`            | Required for R2                             | Private bucket name; 3–63 lowercase alphanumeric/dash characters. Server configuration, no default.                                              |
| `R2_ACCESS_KEY_ID`     | Required for R2                             | Server-only bucket-scoped access key, at least 16 characters.                                                                                    |
| `R2_SECRET_ACCESS_KEY` | Required for R2                             | Server-only S3 secret, at least 32 characters.                                                                                                   |
| `R2_UPLOAD_SECRET`     | Required for R2                             | Independent server-only upload-ticket signing secret, at least 32 characters.                                                                    |

Only signed upload/read URLs and tickets are sent to the client, not storage
credentials. Configure private bucket access, CORS and staging lifecycle separately
using [Vercel deployment](VERCEL_DEPLOYMENT.md). Changing `R2_ACCOUNT_ID` requires
rebuilding the frontend CSP.

### PowerShell example

Use a disposable local account, not a production credential:

```powershell
$env:DATABASE_URL = 'postgresql://blog:local-development-only@localhost:5432/blog'
$env:PUBLIC_API_URL = 'http://localhost:5181'
$env:PUBLIC_SITE_URL = 'http://localhost:5173'
$env:SITE_URL = 'http://localhost:5173'
$env:MEDIA_STORAGE = 'local'
$env:MEDIA_DIR = "$PWD\data\media"
$env:ADMIN_EMAIL = 'admin@example.com'
$env:ADMIN_PASSWORD = 'replace-with-a-local-development-password'
$env:ADMIN_NAME = 'Local Admin'
pnpm db:migrate
pnpm seed
pnpm dev:api
```

Set relevant variables again in the terminal running `pnpm dev:frontend`.
PowerShell 5.1 uses `;` rather than `&&`; stop after a failing command rather
than assuming chained commands succeeded.

### POSIX example

```sh
export DATABASE_URL='postgresql://blog:local-development-only@localhost:5432/blog'
export PUBLIC_API_URL='http://localhost:5181'
export PUBLIC_SITE_URL='http://localhost:5173'
export SITE_URL='http://localhost:5173'
export MEDIA_STORAGE='local'
export ADMIN_EMAIL='admin@example.com'
export ADMIN_PASSWORD='replace-with-a-local-development-password'
export ADMIN_NAME='Local Admin'
pnpm db:migrate
pnpm seed
pnpm dev:api
```

These examples assume the database already exists and accepts that local
credential. Do not use the sample password on an exposed database.

## Starting and bootstrapping

1. Start PostgreSQL and create the configured database/user.
2. Install dependencies from the lockfile.
3. Run `pnpm db:migrate`.
4. Run `pnpm seed` to create the admin and import `content/posts`.
5. Start `pnpm dev:api` and `pnpm dev:frontend` in separate terminals.
6. Open `/login`, sign in, and verify `/admin` plus a public post.

Seed is idempotent for an existing email: it does **not** reset that user's
password. It also imports content, so it is not a harmless password-management
command. Review authoring files before seeding a database with existing edits.

PostgreSQL must accept connections from the API process at the configured host
and port. Use certificate-verified TLS for remote database hosts.

## Commands

| Command                                         | Effect                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm dev:frontend`                             | Frontend development server, normally `:5173`                                          |
| `pnpm dev:api`                                  | API development process, normally `:5181`                                              |
| `pnpm db:generate`                              | Generate a migration from schema changes                                               |
| `pnpm db:migrate`                               | Apply pending migrations                                                               |
| `pnpm seed`                                     | Bootstrap admin and import authoring files                                             |
| `pnpm user:create`                              | Create one persistent administrator from private JSON stdin, without importing content |
| `pnpm content:import`                           | Upsert authoring files into PostgreSQL                                                 |
| `pnpm test`                                     | Both packages' Vitest suites                                                           |
| `pnpm check`                                    | API TypeScript and frontend Svelte/type checks                                         |
| `pnpm demo:api`                                 | Loopback-only in-memory preview API with synthetic public posts                        |
| `pnpm --filter benchcore-api exec tsc --noEmit` | API TypeScript check                                                                   |
| `pnpm lint`                                     | Frontend ESLint                                                                        |
| `pnpm build`                                    | Recursive production builds                                                            |
| `pnpm --filter benchcore-frontend start`        | Start `frontend/server.mjs` with trusted runtime origins                               |
| `pnpm format`                                   | Check frontend formatting without modifying files                                      |
| `pnpm start`                                    | Start the unified Node service after building and configuring PostgreSQL               |
| `pnpm beta:package`                             | Assemble the production-only Node delivery directory                                   |

## Development boundaries

Keep SQL in repository implementations, rules in services, and rendering in
components. Validate untrusted inputs at the API boundary. Never access
`DATABASE_URL` from frontend browser code.

Tests use memory repositories and need no production secrets or live database.
Actual migration/search/blob behavior needs a separate disposable PostgreSQL
smoke test. See [Testing](TESTING.md).

## Database-free visual preview

In separate terminals:

```sh
pnpm demo:api
pnpm dev:frontend
```

Open `http://localhost:5173`. The preview includes synthetic public notes,
imports authored drafts without publishing them, and creates no administrator
account by default. Content is in memory and disappears on restart. It is not a production
mode or a substitute for PostgreSQL integration testing.

For an optional local admin, set `ADMIN_USERNAME` and `ADMIN_PASSWORD` only in
the preview process environment before starting it. In PowerShell:

```powershell
$env:ADMIN_USERNAME = 'exampleadmin'
$securePassword = Read-Host 'Local preview password' -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
pnpm demo:api
```

Sign in with the username at `/login`. The account is held in memory, not a
production database, and the supplied password is hashed before storage.
For a persistent admin, use PostgreSQL, migrations and `pnpm seed` instead.
