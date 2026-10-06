<!-- @file PostImages.svelte @brief Saved and newly uploaded image management with shared-use confirmation. -->
<script lang="ts">
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
			usage = await inspectImage(key);
		} catch {
			message = 'Cannot check image usage. No image was deleted.';
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
			await deleteImage(pendingKey, usage.version);
			onremoved(pendingKey);
			message = 'Image permanently deleted from storage and removed from saved posts.';
			cancelRemoval();
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'Image deletion failed.';
			cancelRemoval();
		} finally {
			deleting = false;
		}
	}
</script>

{#if keys.length > 0}
	<section class="tool-section" aria-label="Post images">
		<div class="section-banner">// POST IMAGES</div>
		<p class="summary">
			Includes existing images and the cover. Removing an image also deletes the stored file
			permanently, after confirmation.
		</p>
		<p class="field-help">
			Move buttons reorder stand-alone Markdown images. Captions, code and other text stay
			unchanged. Save the post to keep the new order.
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
							aria-label="Move image {key} earlier"
							disabled={disabled || pendingKey !== null || movable.indexOf(key) === 0}
							onclick={() => onmove?.(key, -1)}>Move up</button
						>
						<button
							class="btn"
							type="button"
							aria-label="Move image {key} later"
							disabled={disabled ||
								pendingKey !== null ||
								movable.indexOf(key) === movable.length - 1}
							onclick={() => onmove?.(key, 1)}>Move down</button
						>
					{/if}
					{#if oncover}<button
							class="btn"
							type="button"
							disabled={disabled || pendingKey !== null || managedImageKey(cover) === key}
							onclick={() => oncover?.(key)}
							>{managedImageKey(cover) === key ? 'Current cover' : 'Use as cover'}</button
						>{/if}
					<button
						class="btn"
						type="button"
						disabled={disabled || pendingKey !== null}
						onclick={() => prepareRemoval(key)}>REMOVE</button
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
		aria-label="Confirm permanent image deletion"
	>
		<strong>Delete this image permanently?</strong>
		<p>
			This removes the file from storage, every matching image reference and any matching cover.
		</p>
		{#if usage.uses.length > 0}
			<p>These saved posts will be updated immediately, even without pressing Save:</p>
			<ul>
				{#each usage.uses as post (post.id)}<li>{post.title} ({post.slug})</li>{/each}
			</ul>
		{:else}
			<p>
				No saved post uses this image. Its unsaved references in this editor will also be removed.
			</p>
		{/if}
		<div class="btn-row">
			<button class="btn" type="button" onclick={cancelRemoval} disabled={deleting}>CANCEL</button>
			<button class="btn btn-accent" type="button" onclick={confirmRemoval} disabled={deleting}>
				{deleting ? 'DELETING…' : 'DELETE FILE AND ALL REFERENCES'}
			</button>
		</div>
	</section>
{:else if pendingKey}
	<p class="summary" role="status">Checking saved image usage…</p>
{/if}
{#if message}<p class="summary" role="status">{message}</p>{/if}
