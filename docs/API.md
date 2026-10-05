<!-- @file docs/API.md -->
<!-- @brief REST routes, payload examples, security requirements, and error semantics. -->

# API reference

## Base URLs and conventions

The **0.6.0-beta.1 unified runtime** exposes `/api/*` on the same origin as
the site (default `http://localhost:5180`). Its SSR backend is private and
the production `SITE_URL` is the single trusted mutation origin.

Development API: `http://localhost:5181`. The frontend calls it from the
server using `PUBLIC_API_URL`; the `PUBLIC_` prefix does not authorize exposing
database secrets. Use HTTPS for a public deployment.

JSON request bodies use `Content-Type: application/json`. Timestamps are ISO
strings with a timezone or `null` where accepted. Public reads need no session;
admin reads and writes require an administrator's opaque session cookie.

**Path distinction:** public detail is addressed by **slug**; update/delete
and admin detail are addressed by database **UUID**. `/api/posts/:id` does
not accept a slug for mutation even though the public route shares the prefix.

## Route inventory

| Method | Path | Authentication | Result |
|---|---|---|---|
| GET | `/health` | Public | Service status |
| POST | `/api/auth/login` | Credentials + trusted Origin | User and session cookie |
| POST | `/api/auth/register` | Trusted Origin, no session | Create a reader; no automatic login |
| POST | `/api/auth/password` | Session + current password + trusted Origin | Rotate own password, revoke all sessions |
| POST | `/api/auth/password/forgot` | Trusted Origin | Send a password recovery link |
| POST | `/api/auth/password/reset` | Trusted Origin + reset token | Reset password and revoke all sessions |
| POST | `/api/auth/logout` | Trusted Origin | Revoke session and clear cookie |
| GET | `/api/auth/me` | Session | Current user |
| GET | `/api/posts` | Public | Published-only page |
| GET | `/api/posts/:slug` | Public | Published detail and backlinks |
| GET | `/api/tags` | Public | Tags and public-post counts |
| GET | `/api/admin/posts` | Session | Admin list, including unpublished posts |
| GET | `/api/admin/posts/:id` | Session | Editable post, including Markdown |
| GET | `/api/admin/tags` | Administrator session | Full tag registry, including draft-only names |
| GET | `/api/admin/users` | Administrator session | Account page, `limit` 1–100 and bounded `offset` |
| POST | `/api/admin/users` | Administrator + trusted Origin | Create an explicit reader/admin account |
| PATCH | `/api/admin/users/:id` | Administrator + trusted Origin | Change role or activation, revoke sessions |
| POST | `/api/posts` | Session + trusted Origin | Create post |
| PUT | `/api/posts/:id` | Session + trusted Origin | Partial-field update |
| DELETE | `/api/posts/:id` | Session + trusted Origin | Delete post |
| POST | `/api/render` | Session + trusted Origin | Sanitized Markdown preview |
| POST | `/api/media` | Session + trusted Origin | Upload image |
| GET | `/api/media/:key` | Public | Raw image bytes |
| DELETE | `/api/media/:key` | Session + trusted Origin | Delete image |

There is no promised comments API, tag mutation API,
revision API, or media-list HTTP route. A provider's internal `list()` method
is not an endpoint.

## Origin and sessions

The 0.5.0 mutation boundary checks the request's **exact Origin** against
the comma-separated `API_ALLOWED_ORIGINS`, falling back to `SITE_URL` then
`PUBLIC_SITE_URL` when the allowlist is unset. Missing configuration fails
startup in production; development defaults allow the three localhost ports.
Scheme, hostname, and port matter. `http://localhost:5173` is distinct from
`http://127.0.0.1:5173` and `http://localhost:5180`. Configure origins, not
wildcards or request-derived hostnames.

Direct non-browser clients should send a trusted `Origin` on POST/PUT/DELETE
requests. SvelteKit server actions forward the configured trusted site Origin;
their API transport URL can remain internal. Origin checking is a CSRF
control, not authentication: an unauthenticated client cannot write merely
because it supplies an allowed value.

Successful login sets an HttpOnly, SameSite=Lax session cookie, Secure in
production. The plaintext random token is held by the client; only its hash
is stored. Sessions expire after 30 days. Never log or publish cookie values.

Accounts may have an optional unique username. Login accepts either
`{ "email": "...", "password": "..." }` or
`{ "username": "...", "password": "..." }`, never both identifiers.
Usernames are case-insensitive, 3–32 characters, start with a letter, and contain
letters, digits, underscores or dashes. Legacy email-only accounts keep working.

Registration accepts `username`, `email`, `name`, and a 12–200 character
`password`; unknown fields (including a supplied role) are rejected. Emails
and usernames are case-folded. Public registration always creates a reader.
Registered email addresses are not verified.

Password changes accept `currentPassword` and `newPassword` only, and require
a different 12–200 character new password. The password hash and session version
change atomically; every previous cookie stops authenticating.
Password recovery requires `RESEND_API_KEY`, `PASSWORD_RESET_FROM`, and
`SITE_URL`. The request endpoint always returns the same 202 response for a
valid email shape, whether or not an active account exists. Recovery links
expire after one hour and can be used once. Only SHA-256 token hashes are
stored; a successful reset revokes all existing sessions.
Role/activation PATCH accepts only `role: "reader" | "admin"` and/or
`isActive: boolean`. Removing the final active administrator returns 409.
User DTOs never expose hashes, plaintext passwords or session versions.

## PowerShell walkthrough

Run against disposable local data. These commands work in PowerShell 5.1
without relying on its `curl` alias:

```powershell
$api = 'http://localhost:5181'
$headers = @{ Origin = 'http://localhost:5173' }
$credentials = Get-Credential -UserName 'admin@example.com' -Message 'Local admin'
$login = @{
	email = $credentials.UserName
	password = $credentials.GetNetworkCredential().Password
} | ConvertTo-Json
Invoke-RestMethod -Uri "$api/api/auth/login" -Method Post `
	-Headers $headers -ContentType 'application/json' -Body $login `
	-SessionVariable session
Invoke-RestMethod -Uri "$api/api/auth/me" -WebSession $session
```

Create a draft:

```powershell
$draft = @{
	title = 'First API note'
	slug = 'first-api-note'
	description = 'Created against a disposable development database.'
	status = 'draft'
	tags = @('engineering')
	contentMarkdown = '## Observation'
	publishAt = $null
} | ConvertTo-Json
$post = Invoke-RestMethod -Uri "$api/api/posts" -Method Post `
	-Headers $headers -WebSession $session `
	-ContentType 'application/json' -Body $draft
```

Schedule it by UUID:

```powershell
$schedule = @{ publishAt = '2027-01-15T09:00:00Z' } | ConvertTo-Json
Invoke-RestMethod -Uri "$api/api/posts/$($post.id)" -Method Put `
	-Headers $headers -WebSession $session `
	-ContentType 'application/json' -Body $schedule
```

Log out:

```powershell
Invoke-RestMethod -Uri "$api/api/auth/logout" -Method Post `
	-Headers $headers -WebSession $session
```

Keep passwords out of checked-in scripts and shell history. Avoid printing
`$login`, `$session`, or full authenticated request headers.

## Public posts and search

```text
GET /api/posts?limit=10&offset=0
GET /api/posts?tag=engineering&limit=10&offset=0
GET /api/posts?search=postgresql&limit=10&offset=0
GET /api/posts?tag=engineering&search=publishing
```

The page shape is `{ "items": [...], "total": 42 }`; total refers to eligible
matching posts, not every post in the database. Default pagination is 10 items
and offset 0; the list is capped at 200 items.

Example list item:

```json
{
	"id": "9cc4a5c8-9208-486b-83ce-2497da17fadc",
	"slug": "first-note",
	"title": "First engineering note",
	"description": "A short summary.",
	"tags": ["engineering"],
	"authorName": "Local Admin",
	"publishedAt": "2026-10-01T18:00:00.000Z"
}
```

Detail adds `contentHtml`, `coverImage`, `readingMinutes`, and `backlinks`
(`slug`/`title` pairs). Public DTOs are not an admin Markdown export.

Search uses PostgreSQL full-text semantics, not arbitrary substring matching,
regular expressions, or fuzzy typo correction. The generated vector uses
`simple` (no language-specific stemming) and a GIN index. Do not assume
language-aware ranking or spelling suggestions. URL-encode user search values.
Drafts and archived/future posts remain excluded from results and counts.

## Create/update payload

```json
{
	"title": "A publishing note",
	"slug": "publishing-note",
	"description": "A concise summary.",
	"status": "draft",
	"tags": ["engineering", "publishing"],
	"contentMarkdown": "## Notes\n\nSee [[first-note]].",
	"coverImage": "/api/media/0123456789abcdef0123456789abcdef.png",
	"publishedAt": null,
	"publishAt": "2027-01-15T09:00:00Z"
}
```

Title, slug, and nonempty Markdown are required on creation. Markdown is capped
at 200,000 characters; title at 200, description at 500, and tags at 20 names
of up to 60 characters each. Defaults apply to optional metadata.

`PUT` accepts a partial set of these fields despite using PUT rather than
PATCH. Omission means retain/default according to the service rules; do not
assume `null` is supported for every field. `publishAt` explicitly accepts
ISO string or `null`. `publishedAt` is publication metadata, not the separate
schedule. Duplicate slugs produce conflict errors.

Create normally returns 201; update returns 200; successful delete returns 204
with no JSON body. Use the returned UUID for further mutations.

## Preview

```json
{
	"markdown": "## Preview\n\n**Sanitized** content and [[first-note]]."
}
```

`POST /api/render` returns `{ "html": "..." }`. It uses the same safe rendering
pipeline, not a general-purpose HTML passthrough. Preview does not save a post.

## Media

The Node-compatible upload is JSON/base64 at the API, even though the admin browser form uses
multipart data toward SvelteKit:

```json
{
	"filename": "diagram.png",
	"mime": "image/png",
	"contentBase64": "<base64-encoded-image-bytes>"
}
```

Accepted formats: PNG, JPEG, WebP, GIF. Maximum decoded size: **5 MiB**.
The upload JSON body has an **8 MiB** cap; base64 adds transport overhead.
Regular JSON routes have a **256 KiB** body cap, so a character limit is not
an assurance that every possible Unicode payload fits the byte limit.

Upload returns 201 with stored `key`, `filename`, `mime`, `sizeBytes`, and
`url`. Use the returned URL. Keys are generated identifiers, not filenames;
path separators and traversal strings are rejected.

Image reads are public and can use long-lived immutable cache headers.
Removing a key does not revoke copies already held by browsers or caches.
Deleting a post does not imply automatic cleanup of its referenced images.

Adapter-node must use `BODY_SIZE_LIMIT=8M` to allow these multipart uploads
through the frontend. The unified Node runtime sets this explicitly;
the adapter's upstream default of 512 KiB is too small.

### Browser-direct R2 uploads

With `MEDIA_STORAGE=r2`, authenticated administrators use these exact-Origin
endpoints instead of sending image bodies through Vercel:

- `POST /api/media/upload`: `{ filename, mime, sizeBytes }` returns
  `{ uploadUrl, ticket }`. PUT raw file bytes to the signed R2 URL with the
  declared `Content-Type`, no session cookies, and no redirects.
- `POST /api/media/complete`: `{ ticket }` verifies the administrator, expiry,
  staged object's length/type/ETag and immutable publication; returns 201 with
  the normal media record and same-origin `url`.
- `GET /api/media/:key`: only completed objects receive a no-store 307 redirect
  to a short-lived signed GET. Function responses do not contain image bytes.

Both upload metadata and completion bodies have a 16 KiB cap. The same 5 MiB
file cap and allowed formats apply. See [Vercel deployment](VERCEL_DEPLOYMENT.md)
for private bucket credentials, CORS and lifecycle configuration.

## Errors and limits

Errors are JSON objects with an `error` identifier and, when applicable,
`message` or validation `issues`. Clients should branch on status/identifier,
not exact English message text.

| Status | Meaning |
|---|---|
| 400 | Invalid JSON/fields or rejected domain input |
| 401 | Invalid credentials or missing/expired session |
| 403 | Mutation Origin not allowed, or session owner is not an administrator |
| 404 | Missing resource, including masked unpublished slug |
| 405 | Unsupported route method |
| 409 | Slug conflict |
| 413 | Oversized upload/body where a response can be delivered |
| 429 | Rate limit exceeded |
| 500 | Generic internal failure, without stack trace disclosure |

Rate limits are bounded in-memory controls, not durable quotas. They reset on
restart and are not shared across replicas. Use infrastructure limits for
distributed abuse protection. Inspect `Retry-After` when returned and back off;
do not hammer login or preview endpoints.

Defaults are 120 requests and 10 login attempts per direct peer address per
minute, with at most 10,000 tracked peers. Forwarded-IP headers are not trusted.
Requests proxied by a frontend can share its quota; apply additional controls
at your reverse proxy when deploying behind shared infrastructure.
