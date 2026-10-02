<!-- @file pull_request_template.md -->
<!-- @brief Pull request scope, verification, compatibility, and safety checklist. -->

## Summary

Describe the entire branch's purpose and user/developer impact.

## Related issues

Closes or relates to:

## Changes

- API/services:
- Frontend/content:
- Migrations/storage:
- Documentation/operations:

## Verification

Record actual results; leave unchecked when not run and explain why.

- [ ] `pnpm --filter benchcore-api exec tsc --noEmit`
- [ ] `pnpm check`
- [ ] `pnpm test`
- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] Relevant PostgreSQL migration/search/database-media smoke tests
- [ ] Relevant manual admin/public/media/scheduling checks
- [ ] Light/dark/OLED, keyboard, and narrow-screen checks

Additional tests and limitations:

## Compatibility and operations

Migration steps, backup/rollback implications, API changes, environment changes,
provider migration requirements, and deployment follow-ups:

## Security and privacy

- [ ] Inputs are validated and Markdown remains sanitized.
- [ ] Draft/archived/future content remains excluded from all public surfaces.
- [ ] Authentication, Origin checks, limits, and headers remain appropriate.
- [ ] No secrets, private drafts, uploads, dumps, or cookies in the diff.
- [ ] No analytics/third-party trackers added without explicit project approval.

## Scope checklist

- [ ] Services own rules, repositories own SQL, frontend has no direct DB access.
- [ ] `StorageProvider` remains the media boundary.
- [ ] Dependencies pinned and lockfile reviewed if changed.
- [ ] Documentation and roadmap reflect actual implemented scope.
- [ ] No deferred feature claimed solely because a schema exists.
- [ ] Local version changes do not imply package/release publication.

Known follow-ups:
