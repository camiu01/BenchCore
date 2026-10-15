<!-- @file docs/AUTHORING.md -->
<!-- @brief Markdown/TOML authoring, import semantics, links, and publishing. -->

# Authoring and publishing

Authoring model behind BENCHCORE. Every field below is validated in
`api/src/markdown/` and applied by the import pipeline in `api/src/posts/`,
and mirrored by the suites in `api/tests/`.

## A complete post

Create `content/posts/first-note.md`:

```markdown
+++
title = "First engineering note"
slug = "first-note"
description = "A short summary for listings and search results."
status = "draft"
tags = ["engineering", "notes"]
published_at = "2026-10-01T18:00:00Z"
cover_image = "/api/media/0123456789abcdef0123456789abcdef.png"
+++

## Observation

Write normal **Markdown**. Link another note with [[second-note|the follow-up]].

| Item | Result |
|---|---|
| Prototype | Ready for review |

![Prototype detail](/api/media/0123456789abcdef0123456789abcdef.png)
```

The image key is illustrative; upload an actual image before using its URL.
The opening and closing delimiters are exactly **three plus signs** (`+++`),
not YAML `---` fences. Keep timestamp values quoted: the validation contract
expects ISO strings with a timezone.

## TOML metadata

| Field | Required/default | Contract |
|---|---|---|
| `title` | Required | Nonempty string, at most 200 characters |
| `slug` | Required | 1–100 lowercase alphanumeric/dash characters, e.g. `first-note` |
| `description` | Default `""` | At most 500 characters |
| `status` | Default `"draft"` | `draft`, `published`, or `archived` |
| `tags` | Default `[]` | At most 20 names; each 1–60 characters |
| `published_at` | Optional | Quoted ISO date/time with offset or `Z` |
| `publish_at` | Optional | Draft schedule as a quoted ISO date/time with offset or `Z` |
| `cover_image` | Optional | String at most 500 characters |

The filename is not the database identity: the **slug** is the import upsert
key. Use one unique slug per file. Changing a file's slug can create a new post
rather than rename the old one; changing an existing slug through the admin/API
does not create an automatic redirect.

Scheduling uses `publishAt` in the API/admin and `publish_at` in TOML and
persistence. Keep scheduled source posts in `draft` status. Import clears an
existing schedule when `publish_at` is omitted, so reconcile source files
before importing over admin edits.

## Markdown and wikilinks

- Headings, lists, blockquotes, tables, emphasis, code, and standard links are
  rendered through the API's Markdown pipeline.
- HTML is sanitized. Scripts, event handlers, unsafe schemes, and arbitrary
  embedded widgets are not a supported authoring feature.
- LaTeX math uses `$V = IR$` inline and `$$P = VI$$` for display equations,
  including multiline display blocks. The API renders native MathML with KaTeX,
  without browser scripts, external fonts or CDN requests. Code spans/fences
  remain literal. Invalid formulas fall back to readable source. HTML, external
  resources and trusted TeX commands are disabled; each formula is capped at
  4096 characters and 100 macro expansions. Existing posts render math on reads
  without requiring reimport or database updates.
- `[[slug]]` uses the slug as its label.
- `[[slug|Human-readable label]]` uses a custom label.
- `[[glossario-rapido#Baud Rate]]` opens the `Baud Rate` heading in that post.
  `[[Glossario Rapido#Baud Rate|UART speed]]` normalizes the note name to
  `glossario-rapido` and preserves the custom label. `[[#Baud Rate]]` links
  within the current note. The target post and its heading must exist.
- Prefer canonical post slugs. Plain note names normalize spaces and accents
  to slug syntax; they are not a lookup by arbitrary edited post titles.
  Vault import resolves folder paths and filenames before storing canonical links.
- Heading IDs derive from their text, ignore case/accents/punctuation and support
  all six heading levels. Duplicate headings receive `-2`, `-3` suffixes.
  Existing numeric `#post-section-N` links remain supported.
- Backlinks contain only publicly eligible posts. A draft linking a public
  note must not reveal the draft in that note's backlinks.
- Broken-link decoration is advisory; it can depend on known slugs at render
  time. A link existing in Markdown does not mean its target is public.

Use absolute local media paths such as `/api/media/<key>` returned by upload.
Relative-image prefix rewriting can differ by rendering context; full returned
URLs avoid relying on that behavior.

Windows CRLF sources are normalized before TOML parsing. Import validates all
files before writing them, so a wikilink can target a later source file.

## Import

### Obsidian vaults

From the admin panel, choose **Import Obsidian vault** (`/admin/import`) and upload
a ZIP of the vault or a selected folder. Review the contents before confirming.
The original vault is never modified. Markdown notes in nested folders are supported;
hidden folders (including `.obsidian` and `.trash`) and attachments are skipped.

You can also select multiple `.md` files directly in the same file picker
(Ctrl/Shift selection), without making a ZIP. Choose either one ZIP or a Markdown
batch, never a mixture. Direct uploads use filenames as note paths, require unique
filenames, and share the same visibility choice and Markdown limits. Use ZIP when
you need to preserve folder paths or distinguish notes with the same filename.

Choose one visibility for the whole import:

- **Private** (default): administrator-only drafts, excluded from public and reader views.
- **Authenticated readers**: published immediately with reader-only content. Titles
  and descriptions may still appear in public listings, following normal reader-post rules.
- **Public**: published immediately for everyone.

Private means all BenchCore administrators can manage these drafts, not a personal,
owner-only encrypted vault. Change a note's status/audience later in the post editor.
Source YAML cannot override the selected visibility or schedule publication.

Local CLI alternative (requires `DATABASE_URL` and existing migrations):

```powershell
pnpm obsidian:import "C:\Users\LorenzoCamuso\Documents\Obsidian" private
pnpm obsidian:import "C:\path\to\selected-folder" readers
pnpm obsidian:import "C:\path\to\selected-folder" public
```

Both modes accept up to 500 notes, 200 KB per note and 2 MB of Markdown;
ZIP uploads also have a 2 MB compressed limit. Split larger vaults into folders.
Only UTF-8 Markdown is supported. CLI imports do not upload attachments.

Optional YAML `title`, `description` and `tags` properties are supported.
Without a title, the filename is used. Slugs come from normalized vault-relative
paths, so importing a differently rooted folder or ZIP can produce different slugs.
Existing slugs and duplicate normalized paths produce per-file errors and are
never overwritten, including when importing again with another visibility.
Other valid files can still be imported; the CLI returns nonzero if any file fails.

Wikilinks resolve paths, relative paths and unique filenames across the import.
Aliases and section references are preserved. Heading links such as
`[[Glossario Rapido#Baud Rate]]` open the matching section. Obsidian block IDs
(`^block-id`) are not supported. Missing or ambiguous wikilinks and embeds become
readable labels with warnings. Standard Markdown links are kept as written,
so vault-relative Markdown links and images may need manual correction.
Code is left unchanged by the conversion. The normal sanitized renderer remains
responsible for HTML output.

Earlier imports may have removed unresolved links or section fragments. Those
cannot be reconstructed from the stored labels: restore the original wikilinks
in the editor. Import remains create-only and never overwrites existing notes.

```sh
pnpm content:import
```

The script requires `DATABASE_URL`. `CONTENT_DIR` overrides the source
directory; otherwise it resolves the repository's `content/posts` folder.
Only `.md` files directly in that directory are imported; do not rely on
recursive vault discovery.

Import reports created/updated slugs and per-file errors, then exits nonzero
if any file fails. Successful files are not rolled back just because another
file is invalid.

Important consequences:

1. Repeated import updates by slug, not by filename or UUID.
2. Import can overwrite changes made later in the admin editor.
3. Deleting a source file does not automatically delete its database post.
4. Admin changes do not export back to source files automatically.
5. Uploaded images are not copied merely because Markdown references them.
6. Source files are not a complete backup of runtime/admin state.

Choose a working authority per post: versioned authoring files with deliberate
imports, or runtime editing with deliberate source reconciliation.

## Publication lifecycle

| State | Public? | Intended use |
|---|---|---|
| `draft` | No | Writing and reviewing |
| `published` with eligible publication date | Yes | Public content |
| `published` with future/null publication date | No | Not yet publicly eligible |
| `archived` | No | Retained but removed from public view |

Same-state edits and transitions among these states are supported. Publishing
without an explicit publication date stamps the current time when applicable.
`publishedAt` is publication metadata, while `publishAt` is the separate
schedule introduced in 0.5.0.

### Schedule a draft

Set a future ISO timestamp with a timezone in the admin's scheduling field or:

```json
{
	"status": "draft",
	"publishAt": "2027-01-15T09:00:00Z"
}
```

Use `null` to clear an API schedule. The API-process due job checks roughly
once per minute; expect publication on a subsequent tick, not precisely at the
scheduled second. The API must remain running. Check the server's clock and
persisted schedule when investigating delays.

Do not use scheduling as a confidentiality boundary for uploaded images:
media is public by key regardless of a referencing post's status.

## Editorial checklist

- [ ] Unique slug and useful description.
- [ ] Accurate status and timezone-qualified timestamps.
- [ ] Preview through the actual API sanitizer.
- [ ] Link targets and image URLs work.
- [ ] Images have meaningful alt text and no private metadata/content.
- [ ] Public listing/detail/tag/search behavior matches the intended state.
- [ ] Source and admin changes are reconciled before the next import.
