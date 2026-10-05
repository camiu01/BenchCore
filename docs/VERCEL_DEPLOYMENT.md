<!-- @file VERCEL_DEPLOYMENT.md -->
<!-- @brief Full-app Vercel deployment with private R2 storage and disabled scheduled publication. -->

# Vercel and private R2

Deploy the **whole app**, including `/api/*`, with Node.js 24. The API runs
in-process inside SvelteKit Functions, without listeners, migrations or scheduler
timers. The existing [Node artifact](BETA_DEPLOYMENT.md) remains supported.
No cloud resources are created by the build or application.

## Project settings

Import the BenchCore repository, select **SvelteKit**, and set Root Directory to
`frontend`. Enable **Include source files outside of the Root Directory in the
Build Step**: the API and workspace scripts are siblings. Use Node.js **24.x**.
`frontend/vercel.json` selects frozen pnpm installation and `pnpm run build:vercel`.
Do not override the output directory or deploy a Windows-generated output:
Vercel must build the repository on Linux.

Set these environment variables for the intended deployment environments:

| Variable | Value |
| --- | --- |
| `DEPLOYMENT_TARGET` | `vercel` |
| `SCHEDULER_ENABLED` | `false` |
| `DATABASE_URL` | Private PostgreSQL connection URL, TLS enabled, preferably the provider's pooled endpoint |
| `SITE_URL` | Exact canonical HTTPS origin, no path |
| `PUBLIC_SITE_URL` | Same canonical HTTPS origin |
| `PUBLIC_API_URL` | Canonical HTTPS origin, no `/api` suffix |
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

- Scheduling is temporarily disabled on Vercel. Scheduled drafts remain private;
  the editor preserves their dates but does not offer new schedules. Publish
  manually. No cron or request-triggered publication is installed.
- PostgreSQL pools use three connections per Function instance. Provider pooling
  is still needed as instances scale; the in-memory rate limiter is per instance,
  not a shared production perimeter. Add platform-level abuse controls before
  opening public registration.
- Before production: rotate bootstrap passwords, verify backups/restores, set
  trusted HTTPS origins, and use deployment protection for private previews.
- Run `pnpm check`, `pnpm test`, `pnpm lint`, `pnpm build`, and
  `pnpm build:vercel`. CI also builds the Linux Vercel target.
- On the configured deployment, check `/health/live`, `/health/ready`, public
  pages and `/api/posts`. Test registration/login/password revocation and an
  administrator upload at exactly 5 MiB. Confirm bucket preflight/PUT succeeds,
  the published image loads, and draft content remains inaccessible.

Offline tests exercise signatures and protocol behavior but do **not** replace
a real browser upload against your configured bucket. No R2 account credentials
or Vercel project deployment are included in this repository.
