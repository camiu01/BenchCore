<!-- @file NEWSLETTER.md -->
<!-- @brief Explicit newsletter consent, deployment and safe manual delivery. -->

# Newsletter and categories

## Categories

Each post has one optional main category, separate from its tags. Assign it in
the editor or TOML `category` property. `/admin/categories` lists assigned
categories, including drafts, and can rename or clear assignments with explicit
confirmation. Clearing a category never deletes posts.

`/posts?category=Electronics` combines the exact category with existing search,
tag and sort filters. Public category counts never include unpublished posts.

## Explicit email consent

`/newsletter` requires an unchecked consent checkbox. Account registration and
login never subscribe a user. A subscriber must then open the confirmation link
and press its button within 24 hours. Merely opening an email link does not
change consent. Tokens are random, hashed at rest, expiring and single-use.

Pending requests have a ten-minute resend cooldown. Public responses do not
reveal whether an address is already subscribed. Existing subscriber records
without an explicit consent timestamp are excluded from all campaign sends.

Every message includes a signed unsubscribe link. Opening that page and pressing
its button removes the subscriber record and skips queued deliveries without
requiring an account. Messages already in flight can still arrive.

## Enable delivery

This feature is wired by the standalone API (`pnpm dev:api` / API service boot)
and Vercel entrypoints. The unified `pnpm start` runtime currently omits both
newsletter repository and mail dependencies; it reports delivery disabled and
cannot save/send campaigns. Setting these variables does not fix that code gap.

1. Apply the generated `0008` database migration using the normal operator
   migration procedure. Generation does not apply it.
2. Configure `ZOHO_SMTP_USER`, `ZOHO_SMTP_PASSWORD` and a trusted public `SITE_URL`.
   Production requires an HTTPS site URL.
3. Set a dedicated, cryptographically random `NEWSLETTER_TOKEN_KEY` of at least
   32 characters, shared across replicas. Back it up: rotating it invalidates
   unsubscribe links in previously delivered messages.
4. Optionally set `NEWSLETTER_FROM`, then explicitly set `NEWSLETTER_ENABLED=true`.

The newsletter is disabled by default, regardless of password-recovery SMTP
configuration. Never put tokens, addresses or SMTP credentials in application
logs. Configure hosting/access logs to redact query tokens on newsletter links.
The configured mail provider handles subscriber addresses when delivering email.

## Manual preview and send

At `/admin/newsletter`, save a subject and plain-text body. Include public article
links as needed. Saving produces a preview only and sends nothing. Saved content
is immutable; compose a new draft to change it.

Review the preview, check the approval box and type `SEND`. Each explicit action
sends to at most five recipients. Repeat deliberately to drain the queue.
There is no scheduler, automatic publish notification or automatic retry.
The first approved action snapshots up to 1,000 confirmed explicit opt-ins.
Larger lists are rejected before any sends; they need a separately designed
bulk-delivery workflow. Consent is rechecked immediately before each delivery.

Durable per-recipient claims and a unique campaign/recipient index prevent
concurrent requests from sending the same delivery twice. A process interrupted
after claiming can leave an `in flight` outcome. Such deliveries and failures
are never retried automatically because SMTP success may be ambiguous.
Inspect provider delivery records before any manual recovery.

The dashboard shows counts and previews, never subscriber email addresses.
Unit and HTTP tests use fake delivery and in-memory repositories, not real SMTP
or PostgreSQL. Real SMTP delivery and database migration application remain
separate operator checks.

## API

- `GET /api/categories`: public published category counts.
- `GET /api/admin/categories`: admin counts including unpublished assignments.
- `POST /api/admin/categories`: `{ name, replacement }`, where `null` clears.
- `GET /api/newsletter`: whether opt-in delivery is configured.
- `POST /api/newsletter/subscribe`: `{ email, consent: true, website: '' }`.
- `POST /api/newsletter/confirm`: `{ token }`, single-use.
- `POST /api/newsletter/unsubscribe`: `{ token }`, signed revocation.
- `GET /api/admin/newsletter`: campaign previews, consent and outcome counts.
- `POST /api/admin/newsletter`: `{ subject, body }`, saves only a draft.
- `POST /api/admin/newsletter/send`: `{ id, confirmation: 'SEND' }`, one batch.

All mutations require a trusted exact Origin. Admin routes require an active
administrator session. Consent endpoints share credential request quotas.
