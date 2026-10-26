<!-- @file RUNTIME_PARITY.md -->
<!-- @brief Explicit deployment differences and the trusted multi-instance abuse-control boundary. -->

# Runtime parity and staging evidence

All production entrypoints use `api/src/configured-services.ts` for repositories,
media, administrator TOTP, configured password recovery and optional newsletter
mail. Construction performs no migrations, provisioning, uploads or email sends.
Unit tests protect shared wiring; they do not prove hosted integrations.

| Capability                                 | Standalone API / unified Node                                               | Vercel Node Functions                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Database, auth, publishing, optional email | Shared services                                                             | Same shared services                                                  |
| Local/database/private R2 media            | All three providers                                                         | Database/R2; local rejected                                           |
| Scheduled publication                      | Timer on startup and roughly every minute, unless `SCHEDULER_ENABLED=false` | **Disabled**, no timer, cron or request-triggered publisher           |
| Browser origin                             | Standalone exact configured list; unified Node only its canonical origin    | Exact configured list plus validated deployment hostname              |
| Quotas                                     | In-memory, per process                                                      | In-memory, per warm instance                                          |
| Deployment checks                          | Local artifacts/fixtures exist; host remains to verify                      | Local Fetch fixture exists; hosted frontend/bindings remain to verify |

R2 browser-direct uploads require a frontend built with the selected
`R2_ACCOUNT_ID` so CSP permits that exact upload host. Set it at build and
runtime on either target; a runtime-only storage switch cannot update CSP.

## Scheduling boundary

Vercel does not provide unattended publication, even when a draft's `publishAt`
is due or `SCHEDULER_ENABLED=true`. Requests/readiness never promote drafts.
Use a supported long-running Node deployment when unattended scheduled
publication is required. Vercel operators must publish intentionally through
the normal guarded administrator workflow, or separately design and approve an
external publisher. This change does not add a public cron endpoint.

This documents a supported target limitation, not equal scheduler behavior.
Any deployment requiring automatic publication must verify that its chosen
Node process is running the timer. Do not mark hosted parity complete from
this document alone.

## Multi-instance abuse boundary

Application quotas are local defense-in-depth, **not a shared security budget**.
They reset on restart and a request routed to another instance has a different
counter. No count or configuration flag makes them fleet-wide.

For public multi-instance deployments:

1. Enforce shared request/connection limits at trusted managed ingress/WAF.
   Cover login/recovery, registration, comments, likes, newsletter consent,
   media signing/completion and administrator mutations. Choose and record
   numeric limits from the deployment's legitimate traffic and provider budget;
   there is no measured universal default in this release.
2. Deny direct origin access that bypasses that ingress. Configure only exact
   immediate proxy IPs on unified Node. The proxy must **overwrite** forwarded
   identity; client-supplied forwarding chains are not trusted identity.
   On Vercel use provider-owned peer identity, never arbitrary caller headers.
3. Share the ingress policy across every replica and preview/public hostname
   that can reach the same resources. Protect direct-upload endpoints and R2
   upload limits as well as page routes.
4. Test that traffic distributed across at least two instances still consumes
   the same ingress budget and returns an appropriate limit response. Confirm
   that spoofed forwarding headers and direct-origin requests cannot bypass it.

If trusted shared ingress cannot enforce the required budget, a reviewed shared
limiter is required before that multi-instance deployment. This work does not
silently waive that requirement or install infrastructure.

## Evidence still needed

Use isolated Node and Vercel staging environments with synthetic accounts,
separate PostgreSQL/R2 resources and a private test mailbox. Never copy production
drafts, users, subscribers or secrets into a fixture.

Record, without connection strings/tokens/private data:

- Candidate artifact/commit, date, runtime, provider/pool configuration and
  deployment identifiers.
- Successful login/logout, registration, reader/admin isolation, draft/private
  masking, exact-Origin rejection, Secure cookies and frontend service binding.
- R2 direct upload/completion/retrieval and actual optional SMTP delivery,
  confirmation/unsubscribe, using only explicitly approved test recipients.
- Cold/warm request samples, error rates and pooling under concurrent instances.
  Agree latency/concurrency acceptance limits **before** measuring them.
- Chosen scheduler target/behavior and two-instance ingress abuse checks above.
- Complete [isolated recovery drill](BACKUP.md), followed by application smoke.
- Manual keyboard/screen-reader, zoom, forced-colors and error-state results.

These are open release gates. CI unit/memory tests, a successful build or an
available cloud connector are not permission to create/deploy resources, send
messages or write staging/production state.
