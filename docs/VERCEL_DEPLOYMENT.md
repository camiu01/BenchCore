<!-- @file VERCEL_DEPLOYMENT.md -->
<!-- @brief Full-app Vercel deployment with private R2 storage and disabled scheduled publication. -->

# Vercel and private R2

Serverless target behind BENCHCORE. The API entrypoint is `api/src/vercel.ts`,
the build is assembled by `scripts/build-vercel.mjs`, and the checks are
mirrored by `pnpm test:vercel-api` and CI in `.github/`.

Deploy the **whole app** as two independently built services on Node.js 24.
`frontend` serves pages; `api` serves `/api`, `/api/*`, `/health` and `/health/*`.
The API runs native Node Functions, without listeners, migrations or scheduler
timers. The existing [Node artifact](BETA_DEPLOYMENT.md) remains supported.
No cloud resources are created by the build or application.

## Project settings

Import the BenchCore repository and set the project Root Directory to the
**repository root**, not `frontend`. Use Node.js **24.x**. Root `vercel.json`
defines each service's framework/runtime, entrypoint, frozen install and build
command. Remove old project-level build/output overrides.
Do not override the output directory or deploy a Windows-generated output:
Vercel must build the repository on Linux.

The API's `build:vercel` command typechecks without emitting `dist`, then bundles
the Fetch entrypoint and its dependencies into `output/index.mjs`. The explicit
ESM extension and self-contained bundle avoid lost package metadata and broken
dependency links. Vercel's backend builder otherwise prefers a detected
`dist/index.js`, starting the standalone server instead of the Fetch handler.
Keep `pnpm build` for Node artifacts and operator CLIs, not the API service's
Vercel build command. After changing this command, redeploy without the existing
build cache.

The `frontend` service declares a one-way `API_SERVICE_URL` URL binding to `api`.
Vercel injects it **at Function runtime**. Do not define it in project settings,
env files or build scripts. Server-side reads, actions and session checks use
that private base URL, preserving the API's `/api/*` paths and any internal URL
prefix. Browser requests and media URLs still use the public same-origin paths.
The frontend no longer imports API/database code or initializes API dependencies.
There is no reverse binding and no additional internal-only service.

The ordered root rewrites expose only the API/health prefixes to `api`; every
remaining path goes to `frontend`. Bindings alone do not expose services publicly.

Set these environment variables for the intended deployment environments:

| Variable | Value |
| --- | --- |
| `DEPLOYMENT_TARGET` | `vercel` |
| `SCHEDULER_ENABLED` | `false` |
| `DATABASE_URL` | Private PostgreSQL connection URL, TLS enabled, preferably the provider's pooled endpoint |
| `SITE_URL` | Exact canonical HTTPS origin, no path |
| `PUBLIC_SITE_URL` | Same canonical HTTPS origin |
| `PUBLIC_API_URL` | Optional standalone Node/development setting; Vercel server calls use the injected binding instead |
| `API_ALLOWED_ORIGINS` | Comma-separated exact HTTPS origins, including any branch aliases used for mutations |
| `MEDIA_STORAGE` | `r2` |
| `R2_ACCOUNT_ID` | Cloudflare's 32-character lowercase hexadecimal account ID |
| `R2_BUCKET` | Private bucket name |
| `R2_ACCESS_KEY_ID` | Bucket-scoped S3 access key |
| `R2_SECRET_ACCESS_KEY` | Corresponding private S3 secret |
| `R2_UPLOAD_SECRET` | Independent random secret of at least 32 characters |

Set `R2_ACCOUNT_ID` at **build and runtime**: it also fixes the allowed browser
upload hostname in CSP. Redeploy when it changes. Never expose the access key,
S3 secret, database URL or upload secret with a `PUBLIC_` or `VITE_` prefix.
Use separate preview database/bucket credentials, not production data.
Vercel's validated `VERCEL_URL` deployment origin is allowed automatically;
custom domains and branch aliases require explicit allowlisting.

Apply existing migrations explicitly from a trusted workstation or deployment
job with the target database environment, using `pnpm beta:migrate` after an API
build. Provision administrators through private stdin using `pnpm user:create`.
Do not seed a production database or run migrations on Function startup.

## Private Cloudflare R2 bucket

Keep public bucket access disabled. Issue an **Object Read & Write** API token
limited to this bucket. The application requires HEAD/GET, PUT, conditional
COPY, DELETE and LIST; it does not need account administration permissions.
Configure bucket CORS for each exact browser origin:

```json
[
	{
		"AllowedOrigins": ["https://your-site.example"],
		"AllowedMethods": ["PUT"],
		"AllowedHeaders": ["content-type"],
		"MaxAgeSeconds": 3600
	}
]
```

Configure a lifecycle rule deleting only the **`staging/` prefix** after one day.
Do not apply that rule to `objects/` or `media/`, which hold published bytes and
metadata. Back up both prefixes together with PostgreSQL. Failed operations can
leave unreferenced immutable objects; reconcile those against sidecars before
deleting anything. R2 media is not part of database backups.

Administrators request a 120-second signed PUT URL and upload up to **5 MiB**
directly from the browser to R2. Session cookies are never sent to R2. Completion
checks an owner-bound HMAC ticket and the staged object's MIME, byte size and ETag,
copies to a unique immutable object, then conditionally publishes its sidecar.
Retries cannot replace an already published object. Public `/api/media/{key}`
returns a no-store redirect to a 60-second signed GET, avoiding Vercel's
**4.5 MB Function payload limit**. Existing Markdown media URLs remain same-origin.

## Limits and verification

Run all services locally from the repository root using:

```sh
pnpm dlx vercel@62.2.0 dev -L --listen 127.0.0.1:5180
```

`-L` runs without cloud linking; omit it when deliberately testing a linked
project. Vercel injects the binding automatically in both modes. Use local-only
database/media fixtures, and stop any existing owner-controlled listener on the
chosen port first. Do not use ports 3000/3001 for this repository.

- Scheduling is temporarily disabled on Vercel. Scheduled drafts remain private;
  the editor preserves their dates but does not offer new schedules. Publish
  manually. No cron or request-triggered publication is installed.
- PostgreSQL pools use three connections per Function instance. Provider pooling
  is still needed as instances scale; the in-memory rate limiter is per instance,
  not a shared production perimeter. Internal calls can share a transport-peer
  quota; arbitrary forwarded-IP headers are not trusted. Add platform-level abuse controls before
  opening public registration.
- Before production: rotate bootstrap passwords, verify backups/restores, set
  trusted HTTPS origins, and use deployment protection for private previews.
- Run `pnpm check`, `pnpm test`, `pnpm lint`, `pnpm build`, and
  `pnpm build:vercel`. Run `pnpm test:vercel-api` to build the API with the pinned
  production backend builder and load its actual packaged entrypoint in a
  credential-free fixture. CI runs both Vercel checks on Linux.
  This loads the unmodified packaged ESM bundle on Windows and Linux.
- On the configured deployment, check `/health/live`, `/health/ready`, public
  pages and `/api/posts`. Test registration/login/password revocation and an
  administrator upload at exactly 5 MiB. Confirm bucket preflight/PUT succeeds,
  the published image loads, and draft content remains inaccessible.

Offline tests exercise signatures and protocol behavior but do **not** replace
a real browser upload against your configured bucket. No R2 account credentials
or Vercel project deployment are included in this repository.
