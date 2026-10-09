<!-- @file PostPreviewCard.svelte @brief Accessible linked-post card with cancellation and no stored viewer data. -->
<script lang="ts">
	import { loadPostPreview, previewCover, type PostPreview } from '../post-preview.js';
	import type { PreviewController, PreviewTarget } from '../linked-previews.js';
	import { t } from '../i18n/t.svelte.js';
	let { target, controller }: { target: PreviewTarget; controller: PreviewController } = $props();
	let preview = $state<PostPreview | null>(null);
	let loading = $state(true);
	const cover = $derived(preview ? previewCover(preview) : null);
	$effect(() => {
		const slug = target.slug;
		const abort = new AbortController();
		let active = true;
		loading = true;
		preview = null;
		void loadPostPreview(slug, abort.signal).then((item) => {
			if (!active) return;
			preview = item;
			loading = false;
		});
		return () => {
			active = false;
			abort.abort();
		};
	});
</script>

<div
	class="post-preview-card"
	role="dialog"
	aria-modal="false"
	aria-label={t('public.preview.aria')}
	tabindex="-1"
	style:left="{target.x}px"
	style:top="{target.y}px"
	onpointerenter={() => controller.hold()}
	onpointerleave={() => controller.close()}
	onfocusin={() => controller.hold()}
	onfocusout={() => controller.close()}
	onkeydown={(event) => {
		if (event.key === 'Escape') controller.dismiss();
	}}
>
	<div class="preview-heading">
		<span class="field-label">{t('public.preview.label')}</span>
		<button
			class="btn"
			type="button"
			onclick={() => controller.dismiss()}
			aria-label={t('public.preview.closeAria')}>{t('public.preview.close')}</button
		>
	</div>
	{#if loading}<p role="status">{t('public.preview.loading')}</p>
	{:else if preview}
		<h3>{preview.title}</h3>
		{#if preview.locked}<p>{t('public.preview.locked')}</p>
		{:else}
			{#if cover}<img src={cover} alt="" />{/if}
			{#if preview.description}<p>{preview.description}</p>{/if}
		{/if}
		{#if preview.tags.length}<p class="field-help">{preview.tags.join(' · ')}</p>{/if}
	{:else}<p role="status">{t('public.preview.unavailable')}</p>{/if}
	<a class="btn" href="/posts/{encodeURIComponent(target.slug)}">{t('public.preview.open')}</a>
</div>

<style>
	.post-preview-card {
		position: fixed;
		z-index: 30;
		width: min(312px, calc(100vw - 16px));
		max-height: min(480px, calc(100vh - 16px));
		overflow: auto;
		padding: 16px;
		box-sizing: border-box;
		border: 2px solid var(--border);
		background: var(--sheet-bg);
		color: var(--ink);
		box-shadow: 6px 6px 0 var(--shadow-ink);
	}
	.preview-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	h3 {
		font-size: 16px;
		line-height: 1.5;
		margin: 12px 0;
	}
	p {
		font-size: 13px;
		line-height: 1.7;
	}
	img {
		width: 100%;
		max-height: 120px;
		object-fit: cover;
		margin-top: 8px;
	}
	.post-preview-card .btn {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
</style>
