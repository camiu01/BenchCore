<!-- @file CopyImageLink.svelte @brief Image link copy button with accessible feedback and a manual fallback. -->
<script lang="ts">
	import { tick } from 'svelte';
	import { copyImageLink, resolveImageLink } from '../image-link.js';

	interface Props {
		url: string;
		name?: string;
	}
	let { url, name = 'this image' }: Props = $props();
	let busy = $state(false);
	let outcome = $state<{ source: string; copied: boolean; link: string } | null>(null);
	const result = $derived(outcome?.source === url ? outcome : null);
	let manualInput = $state<HTMLInputElement>();

	/** @brief Copies the requested image link or reveals a selectable fallback. @return Completion. */
	async function copyLink(): Promise<void> {
		if (busy) return;
		const source = url;
		let link = '';
		busy = true;
		outcome = null;
		try {
			link = resolveImageLink(source, window.location.origin);
			await copyImageLink(link, navigator.clipboard);
			outcome = { source, copied: true, link };
		} catch {
			outcome = { source, copied: false, link };
			await tick();
			manualInput?.focus();
			manualInput?.select();
		} finally {
			busy = false;
		}
	}
</script>

<div class="copy-link-control">
	<button
		class="btn"
		type="button"
		onclick={copyLink}
		disabled={busy}
		aria-label="Copy image link for {name}"
	>
		{busy ? 'Copying…' : result?.copied ? 'Copied' : 'Copy link'}
	</button>
	{#if result?.copied}
		<span class="field-help" role="status">Link copied.</span>
	{:else if result}
		<div class="copy-link-fallback">
			<p class="field-help" role="status">
				{result.link
					? 'Clipboard access is unavailable. Select and copy the link below.'
					: 'Unable to create this image link.'}
			</p>
			{#if result.link}
				<input
					bind:this={manualInput}
					class="field-input"
					type="text"
					readonly
					value={result.link}
					aria-label="Image link for {name}"
					onfocus={(event) => event.currentTarget.select()}
				/>
			{/if}
		</div>
	{/if}
</div>

<style>
	.copy-link-control {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		min-width: 0;
	}
	.copy-link-fallback {
		flex-basis: 100%;
		width: 100%;
	}
	.copy-link-fallback .field-help {
		margin: 0 0 8px;
	}
</style>
