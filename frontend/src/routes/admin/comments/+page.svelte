<!-- @file +page.svelte @brief Administrator comment moderation queue. -->
<script lang="ts">
	import DocShell from '../../../lib/components/DocShell.svelte';
	import Seo from '../../../lib/components/Seo.svelte';
	import { commentActionKeys, commentStatusKeys } from '../../../lib/admin-posts.js';
	import { intlTag } from '../../../lib/i18n/locale.js';
	import { currentLocale, t } from '../../../lib/i18n/t.svelte.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const queues = ['pending', 'approved', 'rejected'] as const;
	const actionOrder = ['approved', 'rejected', 'pending'] as const;
	const nav = $derived([
		{ href: '/admin', label: `[01] ${t('admin.nav.deck')}` },
		{ href: '/admin/posts/new', label: `[02] ${t('admin.nav.newRecord')}` },
		{ href: '/admin/tags', label: `[03] ${t('admin.nav.tags')}` }
	]);
</script>

<Seo
	title={t('admin.comments.title')}
	description={t('admin.comments.description')}
	canonical="{data.siteBase}/admin/comments"
/>
<DocShell
	docId="FORM: BENCHCORE-2026 // REF: COMMENTS"
	title={t('admin.comments.heading')}
	sub={t('admin.comments.sub')}
	{nav}
	footerLeft={t('admin.comments.count', { count: data.items.length })}
	footerRight={t('admin.comments.filter', {
		status: t(commentStatusKeys[data.status]).toUpperCase()
	})}
	activeHref="/admin/comments"
>
	<main>
		<div class="btn-row moderation-filters">
			{#each queues as status (status)}
				<a
					class:btn-accent={data.status === status}
					class="btn"
					href="/admin/comments?status={status}"
					aria-current={data.status === status ? 'page' : undefined}
				>
					{t(commentStatusKeys[status])}
				</a>
			{/each}
		</div>
		{#if data.notice}<p class="summary" role="status">{data.notice}</p>{/if}
		{#if form?.error}<p class="error-stamp" role="alert">{form.error}</p>{/if}
		{#if !data.online}
			<p class="error-stamp" role="alert">{t('admin.comments.unavailable')}</p>
		{:else}
			{#each data.items as comment (comment.id)}
				<article class="record comment-moderation">
					<div class="record-header">
						<span class="record-title">{comment.authorName}</span>
						<span class="stamp">{t(commentStatusKeys[comment.status])}</span>
					</div>
					<p>{comment.content}</p>
					<p class="dim">
						{comment.post?.title ?? t('admin.comments.deletedPost')} · {new Date(
							comment.createdAt
						).toLocaleString(intlTag(currentLocale()))}
					</p>
					<div class="btn-row">
						{#each actionOrder as status (status)}
							<form method="POST" action="?/moderate&status={data.status}&offset={data.offset}">
								<input type="hidden" name="id" value={comment.id} />
								<input type="hidden" name="status" value={status} />
								<button class="btn" type="submit">{t(commentActionKeys[status])}</button>
							</form>
						{/each}
						<form method="POST" action="?/delete&status={data.status}&offset={data.offset}">
							<input type="hidden" name="id" value={comment.id} />
							<button class="btn danger" type="submit">{t('admin.comments.delete')}</button>
						</form>
					</div>
				</article>
			{:else}
				<p class="summary">{t('admin.comments.empty')}</p>
			{/each}
			<nav class="btn-row" aria-label={t('admin.comments.pagination')}>
				{#if data.offset > 0}
					<a
						class="btn"
						href="/admin/comments?status={data.status}&offset={Math.max(0, data.offset - 100)}"
						>{t('admin.comments.previous')}</a
					>
				{/if}
				{#if data.hasMore}
					<a class="btn" href="/admin/comments?status={data.status}&offset={data.offset + 100}"
						>{t('admin.comments.next')}</a
					>
				{/if}
			</nav>
		{/if}
	</main>
</DocShell>
