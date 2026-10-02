<!-- @file PostEditor.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { EditorValues } from '../server/editor-values.js';

	/**
	 * Obsidian-style record editor: write mode plus API-rendered preview,
	 * status stamps, tag CSV and image upload with cursor insertion.
	 */
	interface Props {
		values: EditorValues;
		previewHtml: string | null;
		uploadedUrl: string | null;
		errorMsg: string | null;
		isNew: boolean;
	}

	let { values, previewHtml, uploadedUrl, errorMsg, isNew }: Props = $props();
</script>

{#if errorMsg !== null}
	<span class="error-stamp">{errorMsg}</span>
{/if}

<form method="POST" enctype="multipart/form-data">
	<div class="form-grid">
		<div class="field-row">
			<div>
				<label class="field-label" for="title">Title</label>
				<input class="field-input" id="title" name="title" required value={values.title} />
			</div>
			<div>
				<label class="field-label" for="slug">Slug</label>
				<input class="field-input" id="slug" name="slug" required value={values.slug} />
			</div>
		</div>
		<div>
			<label class="field-label" for="description">Description</label>
			<input class="field-input" id="description" name="description" value={values.description} />
		</div>
		<div class="field-row">
			<div>
				<label class="field-label" for="status">Status</label>
				<select class="field-input" id="status" name="status">
					{#each ['draft', 'published', 'archived'] as status (status)}
						<option value={status} selected={values.status === status}>{status}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="field-label" for="tags">Tags (comma separated)</label>
				<input class="field-input" id="tags" name="tags" value={values.tags} />
			</div>
		</div>
		<div class="field-row">
			<div>
				<label class="field-label" for="published_at">Published at (ISO, blank = auto)</label>
				<input
					class="field-input"
					id="published_at"
					name="published_at"
					placeholder="2026-10-01T18:00:00Z"
					value={values.publishedAt}
				/>
			</div>
			<div>
				<label class="field-label" for="cover_image">Cover image (URL or media key)</label>
				<input class="field-input" id="cover_image" name="cover_image" value={values.coverImage} />
			</div>
		</div>
		<div>
			<label class="field-label" for="publish_at"
				>Schedule publication (ISO with timezone, blank = none)</label
			>
			<input
				class="field-input"
				id="publish_at"
				name="publish_at"
				placeholder="2026-10-01T18:00:00Z"
				value={values.publishAt}
			/>
		</div>
		<div>
			<label class="field-label" for="content">Content (Markdown + [[wikilinks]])</label>
			<textarea class="field-input" id="content" name="content">{values.content}</textarea>
		</div>
	</div>
	<div class="btn-row">
		<button class="btn btn-accent" type="submit" formaction="?/save">SAVE →</button>
		<button class="btn" type="submit" formaction="?/preview" formnovalidate>PREVIEW</button>
		{#if !isNew}
			<button class="btn" type="submit" formaction="?/delete" formnovalidate>DELETE</button>
		{/if}
	</div>

	<hr />
	<label class="field-label" for="image">Attach image (png/jpg/webp/gif, max 5 MiB)</label>
	<input
		class="field-input"
		id="image"
		name="image"
		type="file"
		accept="image/png,image/jpeg,image/webp,image/gif"
	/>
	<div class="btn-row">
		<button class="btn" type="submit" formaction="?/upload" formnovalidate>UPLOAD →</button>
	</div>
	{#if uploadedUrl !== null}
		<p class="summary upload-note">
			Filed at <code>{uploadedUrl}</code> (appended to the content above).
		</p>
	{/if}
</form>

{#if previewHtml !== null}
	<section class="tool-section">
		<div class="section-banner">// READ MODE</div>
		<!-- Preview HTML is sanitized by the API render pipeline. -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="record"><div class="record-body">{@html previewHtml}</div></div>
	</section>
{/if}
