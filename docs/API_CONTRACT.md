<!-- @file API_CONTRACT.md @brief OpenAPI ownership, regeneration and compatibility gates. -->

# Maintain the API contract

The checked-in [OpenAPI 3.1 JSON](openapi.json) describes the current
unversioned HTTP API. Its version follows `api/package.json`, currently 0.8.0.
The contract is an integration artifact, not a declaration that 1.0.0 or API v1
has shipped.

## Generate and check

```sh
pnpm api:spec
pnpm api:spec:check
pnpm check
pnpm test
```

Generation runs offline, does not load `.env`, and does not connect to a
database, storage provider or mail service. Commit the generator sources and
regenerated JSON together. Do not hand-edit `docs/openapi.json`.

The normal `pnpm test` suite already includes contract validation, so CI rejects
an outdated artifact or a route inventory mismatch without a separate workflow.
Use a local OpenAPI-capable viewer/editor to browse the artifact. Nothing is
uploaded or published by these commands.

## Ownership

- `api/src/server.ts` and HTTP/service validators define actual behavior.
- `api/scripts/openapi/helpers.ts` contains shared OpenAPI response/parameter
  builders, including cookie and trusted-Origin requirements.
- `api/scripts/openapi/auth.ts`, `posts.ts`, `media.ts` and `publishing.ts`
  describe existing operations and reuse exported Zod input validators.
- `api/scripts/openapi/schemas.ts` describes wire responses, not database rows.
- `api/scripts/openapi/document.ts` assembles metadata and local references.
- `api/scripts/generate-openapi.ts` writes the reproducible artifact.

The artifact includes sensitive-operation descriptions, but no credentials,
real user records, session values, signed URLs or enrollment secrets.

Some HTTP-local input shapes are mirrored in the generator; update both when
changing them. Custom Zod refinements, normalization, aggregate UTF-8 limits,
cross-field rules and database state cannot all be expressed by JSON Schema.
Those constraints remain explicit operation/schema descriptions and service
tests. For example, login requires exactly one identifier, a changed password
must differ, vault paths must be safe, and scheduled posts must remain drafts.

## What the checks establish

- A pinned development-only Swagger Parser validates OpenAPI structure and
  resolves component references.
- Regeneration must match the checked-in JSON exactly.
- TypeScript AST inspection expands the router's explicit regex alternatives
  and optional paths, then compares every method/path against the artifact.
  An unsupported new route pattern fails rather than silently disappearing.
- Operation IDs are unique; every mutation declares required trusted Origin;
  administrator paths declare session authentication and the admin role.
- Sample real in-memory HTTP responses validate the user/post models used by
  the generator, private-content masking, missing-Origin rejection and 204.

These are not exhaustive request/response validation for every operation.
Existing domain and HTTP tests remain necessary. Local fixtures do not prove
hosted Vercel, PostgreSQL, R2, SMTP or multi-instance behavior.

## Compatibility review before API v1

Keep the freeze gate open until the following are reviewed and recorded:

1. Approve input/output shapes, stable error identifiers, pagination, auth,
   Origin requirements and the partial-field PUT convention.
2. Decide how future breaking changes are versioned; current paths stay
   `/api/*` until that decision is implemented and tested.
3. Exercise supported Node and hosted Vercel integrations, including cookies,
   optional-service 503 behavior and the UUID/slug distinction.
4. Add regression cases for identified compatibility risks and document any
   accepted exceptions. Broader live contract validation remains pending.
5. Complete the 0.9.0 recovery/accessibility/hosting gates and the remaining
   [1.0.0 roadmap](../TODO.md), then separately authorize publication.

Runtime health routing differs by deployment: standalone `/health` reports
service/license; unified Node intercepts it with a status-only payload and
adds `/health/live` and `/health/ready`. Those deployment probes are not
invented as standalone API routes in the contract.
