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
environment-file flag. Vite reads only the frontend's three server-side URL
settings from that file. Exported process variables take precedence.
Production frontend startup uses its own launch environment; copying `.env`
does not export it into your terminal.

| Variable | Consumer | Purpose |
|---|---|---|
| `DATABASE_URL` | API and database scripts | PostgreSQL connection string |
| `PORT` | API/frontend runtime separately | Listening port for that process |
| `PUBLIC_API_URL` | Frontend server | API base reachable from the frontend server |
| `PUBLIC_SITE_URL` | Frontend server | External canonical URL for SEO/feeds |
| `SITE_URL` | API security configuration | Trusted external site origin |
| `API_ALLOWED_ORIGINS` | API security configuration | Comma-separated exact trusted origins; overrides `SITE_URL` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `ADMIN_USERNAME` | Seed script | Initial admin bootstrap; username optional |
| `BODY_SIZE_LIMIT` | Adapter-node | Set to `8M` for supported multipart image uploads |
| `CONTENT_DIR` | Import/seed scripts | Authoring directory override |
| `MEDIA_STORAGE` | API | `local`, `database` or private `r2` storage selection |
| `MEDIA_DIR` | Local media provider | Persistent filesystem media directory |
| `NODE_ENV` | Runtime | Production cookie/security behavior |

Do not treat an unused placeholder secret as active cookie signing. Sessions
are opaque random tokens verified by looking up their stored hashes.

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

| Command | Effect |
|---|---|
| `pnpm dev:frontend` | Frontend development server, normally `:5173` |
| `pnpm dev:api` | API development process, normally `:5181` |
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm seed` | Bootstrap admin and import authoring files |
| `pnpm user:create` | Create one persistent administrator from private JSON stdin, without importing content |
| `pnpm content:import` | Upsert authoring files into PostgreSQL |
| `pnpm test` | Both packages' Vitest suites |
| `pnpm check` | API TypeScript and frontend Svelte/type checks |
| `pnpm demo:api` | Loopback-only in-memory preview API with synthetic public posts |
| `pnpm --filter benchcore-api exec tsc --noEmit` | API TypeScript check |
| `pnpm lint` | Frontend ESLint |
| `pnpm build` | Recursive production builds |
| `pnpm --filter benchcore-frontend start` | Start `frontend/server.mjs` with trusted runtime origins |
| `pnpm format` | Check frontend formatting without modifying files |
| `pnpm start` | Start the unified Node service after building and configuring PostgreSQL |
| `pnpm beta:package` | Assemble the production-only Node delivery directory |

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
