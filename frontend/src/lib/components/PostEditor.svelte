<script lang="ts">
	import { onMount } from 'svelte';
	import type { EditorValues } from '../server/admin-api.js';

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

	let contentEl: HTMLTextAreaElement | undefined = $state(undefined);

	onMount(() => {
		if (uploadedUrl !== null && contentEl !== undefined) {
			contentEl.value = `${contentEl.value}\n\n![](${uploadedUrl})\n`;
		}
	});
</script>

{#if errorMsg !== null}
	<span class="error-stamp">{errorMsg}</span>
{/if}

<form method="POST">
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
			<label class="field-label" for="content">Content (Markdown + [[wikilinks]])</label>
			<textarea class="field-input" id="content" name="content" bind:this={contentEl}
				>{values.content}</textarea
			>
		</div>
	</div>
	<div class="btn-row">
		<button class="btn btn-accent" type="submit" formaction="?/save">SAVE →</button>
		<button class="btn" type="submit" formaction="?/preview">PREVIEW</button>
		{#if !isNew}
			<button class="btn" type="submit" formaction="?/delete">DELETE</button>
		{/if}
	</div>
</form>

<form method="POST" action="?/upload" enctype="multipart/form-data" style="margin-top: 16px;">
	<label class="field-label" for="image">Attach image (png/jpg/webp/gif, max 5 MiB)</label>
	<input class="field-input" id="image" name="image" type="file" accept="image/*" required />
	<div class="btn-row">
		<button class="btn" type="submit">UPLOAD →</button>
	</div>
	{#if uploadedUrl !== null}
		<p class="summary" style="margin-top: 8px;">
			Filed at <code>{uploadedUrl}</code> (inserted above).
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
