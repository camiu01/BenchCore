<!-- @file PostImages.svelte @brief Saved and newly uploaded image management with shared-use confirmation. -->
<script lang="ts">
	import { t } from '../i18n/t.svelte.js';
	import CopyImageLink from './CopyImageLink.svelte';
	import ImagePreview from './ImagePreview.svelte';
	import { reorderableImageKeys } from '../image-order.js';
	import {
		managedImageKeys,
		managedImageKey,
		inspectImage,
		deleteImage,
		type ImageUsage
	} from '../image-manager.js';

	let {
		content,
		cover,
		disabled,
		onbusy,
		oncover,
		onmove,
		onremoved
	}: {
		content: string;
		cover: string;
		disabled: boolean;
		onbusy: (busy: boolean) => void;
		oncover?: (key: string) => void;
		onmove?: (key: string, direction: -1 | 1) => void;
		onremoved: (key: string) => void;
	} = $props();
	const keys = $derived([
		...new Set([...managedImageKeys(content, ''), ...managedImageKeys('', cover)])
	]);
	const movable = $derived(reorderableImageKeys(content));
	let pendingKey = $state<string | null>(null);
	let usage = $state<ImageUsage | null>(null);
	let deleting = $state(false);
	let message = $state('');

	/** @brief Inspects saved uses before asking for confirmation. @param key Media key. @return Completion. */
	async function prepareRemoval(key: string): Promise<void> {
		if (disabled || pendingKey) return;
		pendingKey = key;
		onbusy(true);
		message = '';
		try {
			usage = await inspectImage(key, fetch, t);
		} catch {
			message = t('editor.images.checkFailed');
			cancelRemoval();
		}
	}

	/** @brief Cancels without changing storage or post references. @return Nothing. */
	function cancelRemoval(): void {
		usage = null;
		pendingKey = null;
		onbusy(false);
	}

	/** @brief Applies the explicitly confirmed storage and reference deletion. @return Completion. */
	async function confirmRemoval(): Promise<void> {
		if (!pendingKey || !usage || deleting) return;
		deleting = true;
		try {
			await deleteImage(pendingKey, usage.version, fetch, t);
			onremoved(pendingKey);
			message = t('editor.images.deleted');
			cancelRemoval();
		} catch (cause) {
			message = cause instanceof Error ? cause.message : t('editor.images.deleteFailed');
			cancelRemoval();
		} finally {
			deleting = false;
		}
	}
</script>

{#if keys.length > 0}
	<section class="tool-section" aria-label={t('editor.images.label')}>
		<div class="section-banner">{t('editor.images.banner')}</div>
		<p class="summary">
			{t('editor.images.intro')}
		</p>
		<p class="field-help">
			{t('editor.images.moveHelp')}
		</p>
		<ul class="image-upload-list">
			{#each keys as key (key)}
				<li>
					<ImagePreview url="/api/media/{key}" name={key} />
					<code>{key}</code>
					<CopyImageLink url="/api/media/{key}" name={key} />
					{#if onmove && movable.includes(key)}
						<button
							class="btn"
							type="button"
							aria-label={t('editor.images.moveEarlierAria', { key })}
							disabled={disabled || pendingKey !== null || movable.indexOf(key) === 0}
							onclick={() => onmove?.(key, -1)}>{t('editor.images.moveUp')}</button
						>
						<button
							class="btn"
							type="button"
							aria-label={t('editor.images.moveLaterAria', { key })}
							disabled={disabled ||
								pendingKey !== null ||
								movable.indexOf(key) === movable.length - 1}
							onclick={() => onmove?.(key, 1)}>{t('editor.images.moveDown')}</button
						>
					{/if}
					{#if oncover}<button
							class="btn"
							type="button"
							disabled={disabled || pendingKey !== null || managedImageKey(cover) === key}
							onclick={() => oncover?.(key)}
							>{managedImageKey(cover) === key
								? t('editor.images.currentCover')
								: t('editor.images.useAsCover')}</button
						>{/if}
					<button
						class="btn"
						type="button"
						disabled={disabled || pendingKey !== null}
						onclick={() => prepareRemoval(key)}>{t('editor.images.remove')}</button
					>
				</li>
			{/each}
		</ul>
	</section>
{/if}
{#if pendingKey && usage}
	<section
		class="image-removal-confirmation"
		role="alert"
		aria-label={t('editor.images.confirmLabel')}
	>
		<strong>{t('editor.images.confirmTitle')}</strong>
		<p>
			{t('editor.images.confirmBody')}
		</p>
		{#if usage.uses.length > 0}
			<p>{t('editor.images.confirmUses')}</p>
			<ul>
				{#each usage.uses as post (post.id)}<li>{post.title} ({post.slug})</li>{/each}
			</ul>
		{:else}
			<p>
				{t('editor.images.confirmNoUses')}
			</p>
		{/if}
		<div class="btn-row">
			<button class="btn" type="button" onclick={cancelRemoval} disabled={deleting}
				>{t('editor.images.cancel')}</button
			>
			<button class="btn btn-accent" type="button" onclick={confirmRemoval} disabled={deleting}>
				{deleting ? t('editor.images.deleting') : t('editor.images.deleteAll')}
			</button>
		</div>
	</section>
{:else if pendingKey}
	<p class="summary" role="status">{t('editor.images.checking')}</p>
{/if}
{#if message}<p class="summary" role="status">{message}</p>{/if}
