<!-- @file PostEngagement.svelte @brief Public approved comments and anonymous like controls. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { currentLocale, t } from '../i18n/t.svelte.js';
	import { publicationDate } from '../presentation.js';

	interface PublicComment {
		id: string;
		authorName: string;
		content: string;
		createdAt: string;
	}
	interface Props {
		slug: string;
	}

	let { slug }: Props = $props();
	let comments = $state<PublicComment[]>([]);
	let likeCount = $state(0);
	let liked = $state(false);
	let online = $state(true);
	let submitting = $state(false);
	let liking = $state(false);
	let loading = $state(true);
	let loadingComments = $state(false);
	let hasMoreComments = $state(false);
	let message = $state('');

	/** @brief Loads approved comments and current like state. @return Completion. */
	async function loadEngagement(): Promise<void> {
		try {
			const [commentResponse, likeResponse] = await Promise.all([
				fetch(`/api/posts/${encodeURIComponent(slug)}/comments`),
				fetch(`/api/posts/${encodeURIComponent(slug)}/likes`)
			]);
			if (!commentResponse.ok || !likeResponse.ok) throw new Error('unavailable');
			const page = (await commentResponse.json()) as { items: PublicComment[]; hasMore: boolean };
			comments = page.items;
			hasMoreComments = page.hasMore;
			const likes = (await likeResponse.json()) as { count: number; liked: boolean };
			likeCount = likes.count;
			liked = likes.liked;
		} catch {
			online = false;
		} finally {
			loading = false;
		}
	}

	/** @brief Loads the next bounded page of approved comments. @return Completion. */
	async function loadMoreComments(): Promise<void> {
		if (loadingComments) return;
		loadingComments = true;
		try {
			const response = await fetch(
				`/api/posts/${encodeURIComponent(slug)}/comments?offset=${comments.length}`
			);
			if (!response.ok) throw new Error('unavailable');
			const page = (await response.json()) as { items: PublicComment[]; hasMore: boolean };
			comments = [...comments, ...page.items];
			hasMoreComments = page.hasMore;
		} catch {
			message = t('public.engagement.commentsFailed');
		} finally {
			loadingComments = false;
		}
	}

	/** @brief Toggles this browser's anonymous like. @return Completion. */
	async function toggleLike(): Promise<void> {
		if (loading || liking) return;
		liking = true;
		message = '';
		try {
			const response = await fetch(`/api/posts/${encodeURIComponent(slug)}/likes`, {
				method: 'POST'
			});
			if (!response.ok) throw new Error('unavailable');
			const result = (await response.json()) as { count: number; liked: boolean };
			likeCount = result.count;
			liked = result.liked;
		} catch {
			message = t('public.engagement.likeFailed');
		} finally {
			liking = false;
		}
	}

	/** @brief Submits a comment for moderation. @param event Form event. @return Completion. */
	async function submitComment(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		submitting = true;
		message = '';
		const form = event.currentTarget as HTMLFormElement;
		const fields = new FormData(form);
		const response = await fetch(`/api/posts/${encodeURIComponent(slug)}/comments`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				authorName: fields.get('authorName'),
				content: fields.get('content')
			})
		}).catch(() => null);
		submitting = false;
		if (!response?.ok) {
			message = t('public.engagement.commentFailed');
			return;
		}
		form.reset();
		message = t('public.engagement.submitted');
	}

	onMount(loadEngagement);
</script>

<section class="tool-section engagement">
	<div class="section-banner">{t('public.engagement.banner')}</div>
	<div class="engagement-summary">
		<button
			class:active={liked}
			class="btn like-button"
			type="button"
			onclick={toggleLike}
			disabled={!online || loading || liking}
		>
			<span aria-hidden="true">♥</span>
			{liked ? t('public.engagement.liked') : t('public.engagement.like')} · {likeCount}
		</button>
		<span class="dim">{t('public.engagement.approved', { n: comments.length })}</span>
	</div>

	{#if message}<p class="summary" role="status">{message}</p>{/if}
	{#if !online}
		<p class="error-stamp" role="alert">{t('public.engagement.offline')}</p>
	{:else}
		<div class="comment-list">
			{#each comments as comment (comment.id)}
				<article class="comment">
					<header>
						<strong>{comment.authorName}</strong>
						<time datetime={comment.createdAt}
							>{publicationDate(comment.createdAt, currentLocale())}</time
						>
					</header>
					<p>{comment.content}</p>
				</article>
			{:else}
				<p class="summary">{t('public.engagement.none')}</p>
			{/each}
		</div>
		{#if hasMoreComments}
			<button class="btn" type="button" onclick={loadMoreComments} disabled={loadingComments}>
				{loadingComments ? t('public.engagement.loading') : t('public.engagement.loadMore')}
			</button>
		{/if}
		<form class="form-grid comment-form" onsubmit={submitComment}>
			<label class="field-label" for="comment-author">{t('public.engagement.name')}</label>
			<input
				class="field-input"
				id="comment-author"
				name="authorName"
				minlength="2"
				maxlength="80"
				required
			/>
			<label class="field-label" for="comment-content">{t('public.engagement.comment')}</label>
			<textarea
				class="field-input"
				id="comment-content"
				name="content"
				minlength="2"
				maxlength="2000"
				required></textarea>
			<div class="btn-row">
				<button class="btn btn-accent" type="submit" disabled={submitting}>
					{submitting ? t('public.engagement.sending') : t('public.engagement.submit')}
				</button>
			</div>
		</form>
	{/if}
</section>
