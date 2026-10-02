<!-- @file docs/ADMIN_AND_THEMES.md -->
<!-- @brief Admin workflows, public media caveats, and presentation conventions. -->

# Admin workbench and themes

## Access and navigation

Bootstrap an admin with `pnpm seed`, sign in at `/login`, and open `/admin`.
The deck lists posts including drafts and archived records. Use
`/admin/posts/new` to create and `/admin/posts/<id>` to edit. The tags view
provides a tag inventory; it is not a promised independent tag-management API.

Admin routes resolve the browser session through the API. Redirects and page
guards are convenience controls; the API also requires a session for protected
operations. There is no public sign-up or password-reset email workflow.

## Editing

1. Give the post a title, unique lowercase/dash slug, and description.
2. Enter tags as comma-separated names; blank segments are ignored.
3. Write Markdown in the content area.
4. Preview to see API-rendered sanitized HTML.
5. Save deliberately; preview alone is not persistence.
6. Choose draft/published/archived and verify public visibility.
7. Use a timezone-qualified `publishAt` schedule for delayed publication.

`publishedAt` identifies publication time; `publishAt` is the separate schedule.
Blank publication metadata can use the service's automatic stamping behavior.
Do not treat blank form fields as universally clearing nullable API fields.
Use explicit API `null` where the documented contract supports it.

Save, preview, and upload are separate actions. There is no claimed autosave,
collaborative editing, revision diff, or automatic revision restore.
Keep a copy of unsaved text before switching pages or submitting a separate
upload form. Inspect the editor after an upload and save the intended content.

Deletion is a real database mutation. Back up first when recovery matters;
revision-table groundwork is not a safety net for deleted posts.

## Images

The upload control accepts PNG/JPEG/WebP/GIF up to 5 MiB. SvelteKit converts
the submitted file to the API's JSON/base64 payload. The API returns a
generated media URL that can be inserted into Markdown.

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
