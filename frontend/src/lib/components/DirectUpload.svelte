<!-- @file DirectUpload.svelte @brief Presentation-only controls for browser-direct R2 images. -->
<script lang="ts">
	import { imageUploadQueue, uploadImageBatch, type ImageUploadItem } from '../image-batch.js';
	import CopyImageLink from './CopyImageLink.svelte';
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

	/**
	 * @brief Queues selected files and optionally starts a dropped batch.
	 * @param files Selected images.
	 * @param start Whether to upload immediately.
	 * @return Completion.
	 */
	export async function queueFiles(files: File[], start = false): Promise<void> {
		if (busy || disabled || files.length === 0) return;
		items = imageUploadQueue(files);
		message =
			files.length > 20 ? 'Up to 20 images per batch. Only the first 20 were selected.' : '';
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
			await uploadImageBatch(items, onuploaded, () => {
				items = [...items];
			});
			message = `${completed} of ${items.length} images attached. Save the record to keep them.`;
		} finally {
			busy = false;
			onbusy(false);
		}
	}
</script>

<label class="field-label" for="direct-image">Attach images (up to 20 per batch, 5 MiB each)</label>
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
		>{busy ? `UPLOADING ${completed}/${items.length}…` : 'UPLOAD SELECTED IMAGES →'}</button
	>
</div>
<p class="summary" aria-live="polite">{message}</p>
<p class="summary">
	Select multiple files or drop images onto the Markdown editor. The first successful upload becomes
	the cover only when the cover field is empty.
</p>
{#if items.length > 0}
	<ul class="image-upload-list" aria-label="Image upload queue">
		{#each items as item, index (index)}
			<li>
				{#if item.url}
					<img class="image-upload-thumbnail" src={item.url} alt={item.file.name} />
				{/if}
				<span>{item.file.name}</span>
				<span class="stamp">{item.status === 'uploaded' ? 'IN CONTENT' : item.status}</span>
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
		R2 upload requires JavaScript. Existing image references remain editable.
	</p></noscript
>
