<!-- @file PostEditor.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { EditorValues } from '../server/editor-values.js';
	import DirectUpload from './DirectUpload.svelte';
	import DateTimeField from './DateTimeField.svelte';
	import { insertImageReference } from '../direct-upload.js';
	import {
		filterWikilinkSuggestions,
		findWikilinkQuery,
		wikilinkReplacementRange,
		type WikilinkSuggestion
	} from '../wikilink-suggestions.js';

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
		directUploads?: boolean;
		schedulerEnabled?: boolean;
		wikilinkSuggestions?: WikilinkSuggestion[];
	}

	let {
		values,
		previewHtml,
		uploadedUrl,
		errorMsg,
		isNew,
		directUploads = false,
		schedulerEnabled = true,
		wikilinkSuggestions = []
	}: Props = $props();
	let contentInput: HTMLTextAreaElement;
	let wikiMatches = $state<{ slug: string; title: string }[]>([]);
	let wikiStart = $state(-1);
	let wikiActive = $state(0);

	/**
	 * @brief Updates wikilink matches from the live cursor context.
	 * @return Nothing.
	 */
	function updateWikiMatches(): void {
		const cursor = contentInput.selectionStart;
		const activeQuery = findWikilinkQuery(contentInput.value, cursor);
		if (activeQuery === null) {
			wikiMatches = [];
			wikiStart = -1;
			return;
		}
		wikiStart = activeQuery.start;
		wikiActive = 0;
		wikiMatches = filterWikilinkSuggestions(wikilinkSuggestions, activeQuery.query);
	}

	/**
	 * @brief Inserts one selected wikilink and restores editor focus.
	 * @param slug Selected post slug.
	 * @return Nothing.
	 */
	function insertWikilink(slug: string): void {
		const range = wikilinkReplacementRange(
			contentInput.value,
			contentInput.selectionStart,
			contentInput.selectionEnd,
			wikiStart
		);
		if (range === null) {
			wikiMatches = [];
			wikiStart = -1;
			return;
		}
		contentInput.setRangeText(`${slug}]]`, range.start, range.end, 'end');
		contentInput.dispatchEvent(new Event('input', { bubbles: true }));
		wikiMatches = [];
		wikiStart = -1;
		contentInput.focus();
	}

	/**
	 * @brief Provides keyboard navigation while the suggestions are open.
	 * @param event Textarea keyboard event.
	 * @return Nothing.
	 */
	function handleWikiKeydown(event: KeyboardEvent): void {
		if (wikiMatches.length === 0) return;
		if (
			wikilinkReplacementRange(
				contentInput.value,
				contentInput.selectionStart,
				contentInput.selectionEnd,
				wikiStart
			) === null
		) {
			wikiMatches = [];
			return;
		}
		if (event.key === 'Escape') {
			wikiMatches = [];
			return;
		}
		if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(event.key)) return;
		event.preventDefault();
		if (event.key === 'ArrowDown') wikiActive = (wikiActive + 1) % wikiMatches.length;
		else if (event.key === 'ArrowUp')
			wikiActive = (wikiActive - 1 + wikiMatches.length) % wikiMatches.length;
		else insertWikilink(wikiMatches[wikiActive]!.slug);
	}
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
			<DateTimeField
				id="published_at_picker"
				name="published_at"
				label="Published at (blank = auto)"
				value={values.publishedAt}
			/>
			<div>
				<label class="field-label" for="cover_image">Cover image (URL or media key)</label>
				<input class="field-input" id="cover_image" name="cover_image" value={values.coverImage} />
			</div>
		</div>
		<div>
			<DateTimeField
				id="publish_at_picker"
				name="publish_at"
				label="Schedule publication (blank = none)"
				value={values.publishAt}
				readonly={!schedulerEnabled}
			/>
			{#if !schedulerEnabled}<p class="summary">
					Automatic publication is temporarily disabled. Existing schedules are preserved; clear a
					schedule before publishing manually.
				</p>{/if}
		</div>
		<div>
			<label class="field-label" for="content">Content (Markdown + [[wikilinks]])</label>
			<div class="wikilink-editor">
				<textarea
					bind:this={contentInput}
					class="field-input"
					id="content"
					name="content"
					oninput={updateWikiMatches}
					onclick={updateWikiMatches}
					onkeydown={handleWikiKeydown}>{values.content}</textarea
				>
				{#if wikiMatches.length > 0}
					<div class="wikilink-suggestions" role="listbox" aria-label="Existing post suggestions">
						{#each wikiMatches as post, index (post.slug)}
							<button
								type="button"
								role="option"
								aria-selected={index === wikiActive}
								class:active={index === wikiActive}
								onmousedown={(event) => event.preventDefault()}
								onclick={() => insertWikilink(post.slug)}
							>
								<strong>{post.title}</strong>
								<code>{post.slug}</code>
							</button>
						{/each}
					</div>
				{/if}
			</div>
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
	{#if directUploads}
		<DirectUpload onuploaded={(url) => insertImageReference(contentInput, url)} />
	{:else}
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
	{/if}
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
