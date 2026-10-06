<!-- @file QueuedImagePreview.svelte @brief Immediate bounded local previews with object URL cleanup. -->
<script lang="ts">
	import ImagePreview from './ImagePreview.svelte';
	let { file }: { file: File } = $props();
	let url = $state<string | null>(null);
	$effect(() => {
		url = null;
		if (
			!file.size ||
			file.size > 5 * 1024 * 1024 ||
			!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)
		)
			return;
		const next = URL.createObjectURL(file);
		url = next;
		return () => URL.revokeObjectURL(next);
	});
</script>

{#if url}<ImagePreview {url} name={file.name} sizeBytes={file.size} />{/if}
