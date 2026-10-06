<!-- @file ImagePreview.svelte @brief Image dimensions, size and keyboard-accessible enlarged preview. -->
<script lang="ts">
	import { imageDetails, imageFileSize, type ImageDetails } from '../image-details.js';
	let { url, name, sizeBytes }: { url: string; name: string; sizeBytes?: number } = $props();
	let dialog: HTMLDialogElement;
	let thumbnail = $state<HTMLImageElement>();
	let details = $state<ImageDetails | null>(null);
	let width = $state(0);
	let height = $state(0);
	const size = $derived(sizeBytes ?? details?.sizeBytes ?? null);

	$effect(() => {
		void url;
		width = thumbnail?.complete ? thumbnail.naturalWidth : 0;
		height = thumbnail?.complete ? thumbnail.naturalHeight : 0;
	});

	$effect(() => {
		const controller = new AbortController();
		details = null;
		if (sizeBytes === undefined) {
			void imageDetails(url, controller.signal).then((result) => {
				if (!controller.signal.aborted) details = result;
			});
		}
		return () => controller.abort();
	});

	/** @brief Reads browser-decoded dimensions without trusting file labels. @param event Image load. @return Nothing. */
	function dimensions(event: Event): void {
		if (!(event.currentTarget instanceof HTMLImageElement)) return;
		width = event.currentTarget.naturalWidth;
		height = event.currentTarget.naturalHeight;
	}
</script>

<div class="image-preview">
	<button
		class="image-preview-trigger"
		type="button"
		aria-label="Enlarge image {name}"
		onclick={() => dialog.showModal()}
	>
		<img
			bind:this={thumbnail}
			class="image-upload-thumbnail"
			src={url}
			alt={name}
			onload={dimensions}
			onerror={() => {
				width = 0;
				height = 0;
			}}
			loading="lazy"
		/>
	</button>
	<span class="field-help"
		>{width > 0 ? `${width} × ${height} px` : 'Dimensions unavailable'} · {imageFileSize(
			size
		)}</span
	>
</div>
<dialog bind:this={dialog} class="image-preview-dialog" aria-label="Image preview: {name}">
	<div class="btn-row">
		<strong>{details?.filename ?? name}</strong>
		<button class="btn" type="button" onclick={() => dialog.close()}>Close preview</button>
	</div>
	<img src={url} alt={name} loading="lazy" onload={dimensions} />
	<p class="field-help">
		{width > 0 ? `${width} × ${height} px` : 'Dimensions unavailable'} · {imageFileSize(size)}
	</p>
</dialog>

<style>
	.image-preview {
		display: grid;
		gap: 8px;
	}
	.image-preview-trigger {
		padding: 4px;
		border: 1px solid var(--border);
		background: var(--card-bg);
		cursor: zoom-in;
	}
	.image-preview-trigger .image-upload-thumbnail {
		width: 96px;
		height: 72px;
		object-fit: contain;
		display: block;
	}
	.image-preview-dialog {
		width: min(960px, 92vw);
		max-height: 90vh;
		padding: 24px;
		color: var(--ink);
		background: var(--sheet-bg);
		border: 1px solid var(--border);
	}
	.image-preview-dialog::backdrop {
		background: #0009;
	}
	.image-preview-dialog img {
		display: block;
		max-width: 100%;
		max-height: 65vh;
		margin: 16px auto;
		object-fit: contain;
	}
	.image-preview-dialog strong {
		overflow-wrap: anywhere;
	}
	.image-preview-dialog .btn-row {
		justify-content: space-between;
		flex-wrap: wrap;
	}
</style>
