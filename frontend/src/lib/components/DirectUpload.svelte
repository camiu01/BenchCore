<!-- @file DirectUpload.svelte @brief Presentation-only controls for browser-direct R2 images. -->
<script lang="ts">
	import { directImageUpload } from '../direct-upload.js';
	let { onuploaded }: { onuploaded: (url: string) => void } = $props();
	let file: File | undefined = $state();
	let busy = $state(false);
	let message = $state('');
	/**
	 * @brief Runs the upload helper and reports its validated result.
	 * @return Completion.
	 */
	async function upload() {
		if (!file || busy) {
			return;
		}
		busy = true;
		message = '';
		try {
			const url = await directImageUpload(file);
			onuploaded(url);
			message = 'Image attached. Save the record to keep the reference.';
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'Upload failed.';
		} finally {
			busy = false;
		}
	}
</script>

<label class="field-label" for="direct-image">Attach image (png/jpg/webp/gif, max 5 MiB)</label>
<input
	id="direct-image"
	class="field-input"
	type="file"
	accept="image/png,image/jpeg,image/webp,image/gif"
	onchange={(event) => {
		file = event.currentTarget.files?.[0];
	}}
	disabled={busy}
/>
<div class="btn-row">
	<button class="btn" type="button" onclick={upload} disabled={busy || !file}
		>{busy ? 'UPLOADING…' : 'UPLOAD TO R2 →'}</button
	>
</div>
<p class="summary" aria-live="polite">{message}</p>
<noscript
	><p class="summary">
		R2 upload requires JavaScript. Existing image references remain editable.
	</p></noscript
>
