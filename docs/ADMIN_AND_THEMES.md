<!-- @file docs/ADMIN_AND_THEMES.md -->
<!-- @brief Admin workflows, public media caveats, and presentation conventions. -->

# Admin workbench and themes

## Access and navigation

Bootstrap an admin with `pnpm seed`, sign in at `/login`, and open `/admin`.
The deck lists posts including drafts and archived records. Use
`/admin/posts/new` to create and `/admin/posts/<id>` to edit. The tags view
assigns accessible colors and can delete a tag from every post. The comments
view approves, rejects, reopens or deletes reader responses.

Admin routes resolve the browser session through the API. Redirects and page
guards are convenience controls; the API also requires a session for protected
operations. Public reader registration and Zoho-backed password recovery are
available when their deployment settings are configured.

## Editing

1. Give the post a title, unique lowercase/dash slug, and description.
2. Enter tags as comma-separated names; blank segments are ignored.
3. Write Markdown in the content area. Typing `[[` opens a keyboard-accessible
   list of existing posts; choosing one inserts its slug and closes the wikilink.
4. Preview to see API-rendered sanitized HTML.
5. Save deliberately; preview alone is not persistence.
6. Choose draft/published/archived and verify public visibility.
7. Use the local-time date picker for delayed publication.

Choose **Audience: Public** for ordinary records or **Readers and admins only**
for reader-only records. Audience is separate from publication status: drafts
remain private, even to signed-in readers. Only administrators can create or
edit either kind of record.

Guests see the title and an obscured placeholder with a sign-in invitation.
The placeholder contains no protected text. The API withholds the description,
body, cover and backlinks until a valid reader or administrator session is
present. Public RSS and graph responses also omit protected descriptions and
outgoing reader-only wikilinks. Guest search matches only a reader-only post's
title, never its private body. Personalized pages and responses are not cached.
Signing in from a locked record returns to that record.

Managed images used exclusively by reader-only records require the same
session. Images reused in public records remain public, as do external URLs
and uploads not yet attached to any saved record. Do not reuse public images
for confidential reader-only assets. Previously downloaded files and issued
short-lived R2 read links cannot be revoked retroactively by changing audience.

The audience column requires migration `0006`; deploying the feature does not
apply database migrations automatically. TOML authoring supports
`audience = "readers"`; omitting it keeps new records public and preserves the
audience of an existing record during import.

`publishedAt` identifies publication time; `publishAt` is the separate schedule.
The editor displays both in the browser's local timezone and submits canonical
UTC timestamps.
Blank publication metadata can use the service's automatic stamping behavior.
Do not treat blank form fields as universally clearing nullable API fields.
Use explicit API `null` where the documented contract supports it.

Save, preview, and upload are separate actions. There is no claimed autosave,
collaborative editing, revision diff, or automatic revision restore.
Keep a copy of unsaved text before switching pages or submitting a separate
upload form. Inspect the editor after an upload and save the intended content.

Deletion is a real database mutation. Back up first when recovery matters;
revision-table groundwork is not a safety net for deleted posts.

## Graph and engagement

The public `/graph` page displays only published records and valid wikilinks.
Node colors use the first tag attached to each post. Search, keyboard focus,
zoom, drag and an accessible record index are available.

Comments submitted from a post remain private until approved under
`/admin/comments`. Likes are anonymous and toggle per browser. Moderation and
tag deletion are permanent database mutations.

## Images

The upload control accepts PNG/JPEG/WebP/GIF up to 5 MiB per image.
With R2, select up to 20 images per batch, or drop files onto the Markdown
editor to start uploading. Successful uploads are inserted at the current
cursor automatically, with editable filename-based descriptions. The first
successful image fills the cover field only when it is empty.
Progress and errors are shown per file; retrying skips successful uploads.
The editor and save controls are locked during a batch to preserve insertion
positions. Save the record after uploading.
Other storage providers retain the single-file server upload control.

The **Post images** panel includes existing Markdown images and the cover.
**Remove** first checks saved usages and lists every affected post. Cancel
leaves both content and storage unchanged. Confirming **Delete file and all
references** permanently deletes the file and immediately removes its image
references and cover from saved posts, including other posts using it.
Unsaved references in the current editor and upload previews are also removed.
Code examples and external image URLs are not treated as managed uploads.

If saved usages change before confirmation, inspect them again before retrying.
Storage deletion follows the atomic update of saved references; these are not
one cross-system transaction. A storage failure can leave an unreferenced file,
so the editor reports it explicitly rather than claiming successful deletion.
Avoid concurrent edits while removing shared assets. The confirmation detects
changed saved usages and affected-post versions, but does not reserve the media
key against a new reference added after reference cleanup.

- Add meaningful alt text rather than leaving `![](...)` empty.
- Use the returned `/api/media/<key>` URL for Markdown and cover images.
- Remove private content and sensitive image metadata before uploading.
- Uploading does not publish the post, but the asset itself is public by key.
- Switching media providers does not migrate existing uploaded objects.
- Deleting a post is not guaranteed to delete its images.

For same-origin relative media URLs, a production proxy must route `/api/media`
to the API. A frontend-only host without that routing will return broken images.

## Theme system

Themes: `light`, `dark`, `oled`.

| Mechanism | Location |
|---|---|
| Theme type/state and persistence | `frontend/src/lib/theme.ts` |
| Design tokens and component styles | `frontend/src/app.css` |
| Pre-paint theme restoration | `frontend/src/app.html` |
| Picker UI | `frontend/src/lib/components/ThemePicker.svelte` |
| Shared document shell | `frontend/src/lib/components/DocShell.svelte` |

The root `data-theme` attribute selects token values. Preference is stored
under localStorage key `site-theme`. The pre-paint script applies a stored
preference before normal rendering to reduce flashes.

Core tokens include `--bg`, `--sheet-bg`, `--card-bg`, `--grid`, `--ink`,
`--muted`, `--border`, `--border-light`, and `--accent`.

## Page recipe

- `.wrapper`: bordered sheet and hard shadow.
- `.doc-meta-bar`: document metadata and theme controls.
- `.doc-header`: title and introduction.
- `.record` / `.record-body`: content cards and readable Markdown.
- `.stamp`: status/category badge.
- `.spec-table` / `.inventory-table`: technical data and lists.

New components should reuse tokens and patterns rather than hardcode
dark/light colors. Theme state belongs in the presentation layer; publication
logic belongs in API services.

## Accessibility and security checks

- Label all inputs; preserve keyboard navigation and visible focus.
- Check error/status contrast in all three themes.
- Verify tables and editor controls on narrow screens.
- Preserve meaningful headings and image alt text.
- Render HTML only from the sanitized API pipeline.
- Keep CSP changes aligned with the theme bootstrap and SvelteKit assets.
  Do not solve a theme flash or preview failure by disabling CSP globally.
