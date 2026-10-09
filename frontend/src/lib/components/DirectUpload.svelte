<!-- @file DirectUpload.svelte @brief Presentation-only controls for browser-direct R2 images. -->
<script lang="ts">
	import {
		imageUploadQueue,
		uploadImageBatch,
		moveQueuedImage,
		type ImageUploadItem
	} from '../image-batch.js';
	import { t } from '../i18n/t.svelte.js';
	import CopyImageLink from './CopyImageLink.svelte';
	import ImagePreview from './ImagePreview.svelte';
	import QueuedImagePreview from './QueuedImagePreview.svelte';
	let {
		onuploaded,
		onbusy,
		disabled = false
	}: {
		onuploaded: (url: string, file: File) => void;
		onbusy: (busy: boolean) => void;
		disabled?: boolean;
	} = $props();
	let items = $state<ImageUploadItem[]>([]);
	let busy = $state(false);
	let message = $state('');
	const completed = $derived(items.filter((item) => item.status === 'uploaded').length);
	const pending = $derived(items.some((item) => item.status !== 'uploaded'));
	const statusLabels = {
		queued: 'editor.upload.queued',
		uploading: 'editor.upload.uploadingStamp',
		uploaded: 'editor.upload.inContent',
		failed: 'editor.upload.failed'
	} as const;

	/**
	 * @brief Queues selected files and optionally starts a dropped batch.
	 * @param files Selected images.
	 * @param start Whether to upload immediately.
	 * @return Completion.
	 */
	export async function queueFiles(files: File[], start = false): Promise<void> {
		if (busy || disabled || files.length === 0) return;
		items = imageUploadQueue(files);
		message = files.length > 20 ? t('editor.upload.tooMany') : '';
		if (start) await upload();
	}
	/** @brief Removes a deleted asset from upload previews. @param key Media key. @return Nothing. */
	export function forgetImage(key: string): void {
		items = items.filter((item) => item.url !== `/api/media/${key}`);
	}
	/**
	 * @brief Runs the upload helper and reports its validated result.
	 * @return Completion.
	 */
	async function upload() {
		if (!pending || busy || disabled) {
			return;
		}
		busy = true;
		onbusy(true);
		try {
			await uploadImageBatch(
				items,
				onuploaded,
				() => {
					items = [...items];
				},
				undefined,
				t
			);
			message = t('editor.upload.attached', { done: completed, total: items.length });
		} finally {
			busy = false;
			onbusy(false);
		}
	}
</script>

<label class="field-label" for="direct-image">{t('editor.upload.label')}</label>
<input
	id="direct-image"
	class="field-input"
	type="file"
	multiple
	accept="image/png,image/jpeg,image/webp,image/gif"
	onchange={(event) => {
		void queueFiles(Array.from(event.currentTarget.files ?? []));
		event.currentTarget.value = '';
	}}
	disabled={busy || disabled}
/>
<div class="btn-row">
	<button
		class="btn btn-accent"
		type="button"
		onclick={upload}
		disabled={busy || disabled || !pending}
		>{busy
			? t('editor.upload.uploading', { done: completed, total: items.length })
			: t('editor.upload.start')}</button
	>
</div>
<p class="summary" aria-live="polite">{message}</p>
<p class="summary">
	{t('editor.upload.hint')}
</p>
{#if items.length > 0}
	<ul class="image-upload-list" aria-label={t('editor.upload.queue')}>
		{#each items as item, index (index)}
			<li>
				{#if item.url}
					<ImagePreview url={item.url} name={item.file.name} sizeBytes={item.file.size} />
				{:else}
					<QueuedImagePreview file={item.file} />
				{/if}
				<span>{item.file.name}</span>
				<span class="stamp">{t(statusLabels[item.status])}</span>
				<progress
					max="100"
					value={item.progress}
					aria-label={t('editor.upload.progressAria', { name: item.file.name })}
					>{item.progress}%</progress
				>
				<span class="field-help"
					>{item.progress}%{item.progress === 95 && item.status === 'uploading'
						? ` · ${t('editor.upload.verifying')}`
						: ''}</span
				>
				{#if !completed}
					<button
						class="btn"
						type="button"
						disabled={busy || disabled || index === 0}
						aria-label={t('editor.upload.moveEarlierAria', { name: item.file.name })}
						onclick={() => {
							items = moveQueuedImage(items, index, -1);
						}}>{t('editor.images.moveUp')}</button
					>
					<button
						class="btn"
						type="button"
						disabled={busy || disabled || index === items.length - 1}
						aria-label={t('editor.upload.moveLaterAria', { name: item.file.name })}
						onclick={() => {
							items = moveQueuedImage(items, index, 1);
						}}>{t('editor.images.moveDown')}</button
					>
				{/if}
				{#if item.status === 'uploaded' && item.url}
					<CopyImageLink url={item.url} name={item.file.name} />
				{/if}
				{#if item.error}<span class="error-stamp">{item.error}</span>{/if}
			</li>
		{/each}
	</ul>
{/if}
<noscript
	><p class="summary">
		{t('editor.upload.noscript')}
	</p></noscript
>
