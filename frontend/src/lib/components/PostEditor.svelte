<!-- @file PostEditor.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { EditorValues } from '../server/editor-values.js';
	import { t } from '../i18n/t.svelte.js';
	import DirectUpload from './DirectUpload.svelte';
	import DateTimeField from './DateTimeField.svelte';
	import PostImages from './PostImages.svelte';
	import PostDeleteConfirmation from './PostDeleteConfirmation.svelte';
	import EditorStatus from './EditorStatus.svelte';
	import WikilinkOptions from './WikilinkOptions.svelte';
	import { removeImageFromEditor } from '../image-manager.js';
	import { insertUploadedImage } from '../image-batch.js';
	import { selectImageCover } from '../image-details.js';
	import { moveEditorImage } from '../image-order.js';
	import {
		filterWikilinkSuggestions,
		findWikilinkQuery,
		wikilinkReplacementRange,
		insertEditorWikilink,
		type WikilinkSuggestion
	} from '../wikilink-suggestions.js';

	interface Props {
		values: EditorValues;
		savedValues?: EditorValues;
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
		savedValues = values,
		previewHtml,
		uploadedUrl,
		errorMsg,
		isNew,
		directUploads = false,
		schedulerEnabled = true,
		wikilinkSuggestions = []
	}: Props = $props();
	let contentInput: HTMLTextAreaElement;
	let coverInput: HTMLInputElement;
	let imageUploader = $state<DirectUpload>();
	let uploadingImages = $state(false);
	let removingImages = $state(false);
	let submitting = $state(false);
	const editingMedia = $derived(uploadingImages || removingImages);
	let imageContent = $state<string | null>(null);
	let imageCover = $state<string | null>(null);
	$effect(() => {
		imageContent = values.content;
		imageCover = values.coverImage;
	});
	let uploadCursor = 0;
	let draggingImages = $state(false);
	let deleteConfirmation = $state(false);
	const statusLabels = [
		{ value: 'draft', label: 'editor.status.draft' },
		{ value: 'published', label: 'editor.status.published' },
		{ value: 'archived', label: 'editor.status.archived' }
	] as const;

	/** @brief Locks the insertion position while files upload. @param busy Upload state. @return Nothing. */
	function setUploadBusy(busy: boolean): void {
		if (busy) uploadCursor = contentInput.selectionStart;
		uploadingImages = busy;
		wikiMatches = [];
	}

	/** @brief Inserts an uploaded image and advances the batch cursor. @param url Media URL. @param file Uploaded file. @return Nothing. */
	function attachImage(url: string, file: File): void {
		uploadCursor = insertUploadedImage(contentInput, coverInput, url, uploadCursor, file.name);
	}
	/** @brief Removes the deleted asset from unsaved fields and upload previews. @param key Media key. @return Nothing. */
	function detachImage(key: string): void {
		removeImageFromEditor(contentInput, coverInput, key);
		imageUploader?.forgetImage(key);
	}

	/** @brief Allows file drops onto the editor. @param event Drag event. @return Nothing. */
	function handleImageDrag(event: DragEvent): void {
		if (!directUploads || !event.dataTransfer?.types.includes('Files')) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = editingMedia ? 'none' : 'copy';
		draggingImages = !editingMedia;
	}

	/** @brief Queues dropped files without navigating away from unsaved content. @param event Drop event. @return Nothing. */
	function handleImageDrop(event: DragEvent): void {
		if (!directUploads || !event.dataTransfer?.types.includes('Files')) return;
		event.preventDefault();
		draggingImages = false;
		if (editingMedia) return;
		void imageUploader?.queueFiles(Array.from(event.dataTransfer.files), true);
	}
	let wikiMatches = $state<WikilinkSuggestion[]>([]);
	let wikiStart = $state(-1);
	let wikiActive = $state(0);

	/**
	 * @brief Updates wikilink matches from the live cursor context.
	 * @return Nothing.
	 */
	function updateWikiMatches(): void {
		imageContent = contentInput.value;
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
		insertEditorWikilink(contentInput, slug, wikiStart);
		wikiMatches = [];
		wikiStart = -1;
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
	<p class="error-stamp" role="alert">{errorMsg}</p>
{/if}

<form
	method="POST"
	enctype="multipart/form-data"
	onsubmit={(event) => {
		if (editingMedia) event.preventDefault();
	}}
>
	<EditorStatus
		{values}
		{savedValues}
		{isNew}
		busy={editingMedia}
		onbusy={(busy) => {
			submitting = busy;
		}}
	/>
	<fieldset class="editor-fields" disabled={submitting}>
		<div class="form-grid">
			<div class="field-row">
				<div>
					<label class="field-label" for="title">{t('editor.field.title')}</label>
					<input class="field-input" id="title" name="title" required value={values.title} />
				</div>
				<div>
					<label class="field-label" for="slug">{t('editor.field.slug')}</label>
					<input
						class="field-input"
						id="slug"
						name="slug"
						required
						value={values.slug}
						aria-describedby="slug-help"
					/>
					<span class="field-help" id="slug-help">{t('editor.field.slugHelp')}</span>
				</div>
			</div>
			<div>
				<label class="field-label" for="description">{t('editor.field.description')}</label>
				<input
					class="field-input"
					id="description"
					name="description"
					value={values.description}
					aria-describedby="description-help"
				/>
				<span class="field-help" id="description-help">{t('editor.field.descriptionHelp')}</span>
			</div>
			<div class="field-row">
				<div>
					<label class="field-label" for="status">{t('editor.field.status')}</label>
					<select class="field-input" id="status" name="status">
						{#each statusLabels as status (status.value)}
							<option value={status.value} selected={values.status === status.value}
								>{t(status.label)}</option
							>
						{/each}
					</select>
					<label class="field-label" for="audience">{t('editor.field.audience')}</label>
					<select class="field-input" id="audience" name="audience">
						<option value="public" selected={(values.audience ?? 'public') === 'public'}
							>{t('editor.audience.public')}</option
						>
						<option value="readers" selected={values.audience === 'readers'}
							>{t('editor.audience.readers')}</option
						>
					</select>
				</div>
				<div>
					<label class="field-label" for="tags">{t('editor.field.tags')}</label>
					<input class="field-input" id="tags" name="tags" value={values.tags} />
				</div>
			</div>
			<div class="field-row">
				<DateTimeField
					id="published_at_picker"
					name="published_at"
					label={t('editor.field.publishedAt')}
					value={values.publishedAt}
				/>
				<div>
					<label class="field-label" for="cover_image">{t('editor.field.cover')}</label>
					<input
						bind:this={coverInput}
						class="field-input"
						id="cover_image"
						name="cover_image"
						value={values.coverImage}
						readonly={removingImages}
						oninput={(event) => {
							imageCover = event.currentTarget.value;
						}}
					/>
				</div>
			</div>
			<div>
				<DateTimeField
					id="publish_at_picker"
					name="publish_at"
					label={t('editor.field.publishAt')}
					value={values.publishAt}
					readonly={!schedulerEnabled}
				/>
				{#if !schedulerEnabled}<p class="summary">
						{t('editor.schedulerDisabled')}
					</p>{/if}
			</div>
			<div>
				<label class="field-label" for="content">{t('editor.field.content')}</label>
				{#if directUploads}
					<p class="summary">
						{t('editor.field.contentUploadHint')}
					</p>
				{/if}
				<div class="wikilink-editor">
					<textarea
						bind:this={contentInput}
						class="field-input"
						class:dragging-images={draggingImages}
						id="content"
						name="content"
						readonly={editingMedia}
						ondragover={handleImageDrag}
						ondragleave={() => {
							draggingImages = false;
						}}
						ondrop={handleImageDrop}
						oninput={updateWikiMatches}
						onclick={updateWikiMatches}
						onkeydown={handleWikiKeydown}>{values.content}</textarea
					>
					<WikilinkOptions matches={wikiMatches} active={wikiActive} onselect={insertWikilink} />
				</div>
			</div>
		</div>
		<div class="btn-row editor-actions">
			<button class="btn btn-accent" type="submit" formaction="?/save" disabled={editingMedia}
				>{t('editor.action.save')}</button
			>
			<button
				class="btn"
				type="submit"
				formaction="?/preview"
				formnovalidate
				disabled={editingMedia}>{t('editor.action.preview')}</button
			>
			{#if !isNew}
				<button
					class="btn danger"
					type="button"
					disabled={editingMedia}
					aria-expanded={deleteConfirmation}
					aria-controls="post-delete-confirmation"
					onclick={() => {
						deleteConfirmation = !deleteConfirmation;
					}}>{t('editor.action.delete')}</button
				>
			{/if}
		</div>
		{#if deleteConfirmation}
			<PostDeleteConfirmation
				title={values.title}
				disabled={editingMedia}
				oncancel={() => {
					deleteConfirmation = false;
				}}
			/>
		{/if}

		<hr />
		<PostImages
			content={imageContent ?? values.content}
			cover={imageCover ?? values.coverImage}
			disabled={uploadingImages}
			onbusy={(busy) => {
				removingImages = busy;
			}}
			onremoved={detachImage}
			onmove={(key, direction) => {
				moveEditorImage(contentInput, key, direction);
			}}
			oncover={(key) => {
				selectImageCover(coverInput, key);
			}}
		/>
		{#if directUploads}
			<DirectUpload
				bind:this={imageUploader}
				onuploaded={attachImage}
				onbusy={setUploadBusy}
				disabled={removingImages}
			/>
		{:else}
			<label class="field-label" for="image">{t('editor.field.attachImage')}</label>
			<input
				class="field-input"
				id="image"
				name="image"
				type="file"
				accept="image/png,image/jpeg,image/webp,image/gif"
			/>
			<div class="btn-row">
				<button class="btn" type="submit" formaction="?/upload" formnovalidate
					>{t('editor.action.upload')}</button
				>
			</div>
		{/if}
		{#if uploadedUrl !== null}
			<p class="summary upload-note">
				{t('editor.uploadedAt')} <code>{uploadedUrl}</code>
				{t('editor.uploadedAppended')}
			</p>
		{/if}
	</fieldset>
</form>

{#if previewHtml !== null}
	<section class="tool-section">
		<div class="section-banner">{t('editor.preview.title')}</div>
		<p class="field-help">{t('editor.preview.note')}</p>
		<!-- Preview HTML is sanitized by the API render pipeline. -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="record"><div class="record-body">{@html previewHtml}</div></div>
	</section>
{/if}
