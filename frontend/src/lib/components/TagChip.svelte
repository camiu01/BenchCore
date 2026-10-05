<!-- @file TagChip.svelte @brief Colored tag badge using CSP-safe SVG presentation attributes. -->
<script lang="ts">
	let { label, color }: { label: string; color: string } = $props();
	const fill = $derived(/^#[0-9a-f]{6}$/i.test(color) ? color : '#64748B');
</script>

<span class="tag-chip">
	<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
		<rect width="10" height="10" {fill} />
	</svg>
	{label}
</span>

<style>
	.tag-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border-left-width: 1px;
	}
</style>
