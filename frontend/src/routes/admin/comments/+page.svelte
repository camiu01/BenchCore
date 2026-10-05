<!-- @file +page.svelte @brief Administrator comment moderation queue. -->
<script lang="ts">
	import DocShell from '../../../lib/components/DocShell.svelte';
	import Seo from '../../../lib/components/Seo.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const nav = [
		{ href: '/admin', label: '[01] deck' },
		{ href: '/admin/posts/new', label: '[02] new record' },
		{ href: '/admin/tags', label: '[03] tags' }
	];
</script>

<Seo
	title="Comments | BenchCore Admin"
	description="Moderate reader comments."
	canonical="{data.siteBase}/admin/comments"
/>
<DocShell
	docId="FORM: BENCHCORE-2026 // REF: COMMENTS"
	title="COMMENT QUEUE"
	sub="Review reader responses before public display."
	{nav}
	footerLeft="COMMENTS: {data.items.length}"
	footerRight="FILTER: {data.status.toUpperCase()}"
	activeHref="/admin/comments"
>
	<main>
		<div class="btn-row moderation-filters">
			{#each ['pending', 'approved', 'rejected'] as status (status)}
				<a
					class:btn-accent={data.status === status}
					class="btn"
					href="/admin/comments?status={status}"
				>
					{status}
				</a>
			{/each}
		</div>
		{#if data.notice}<p class="summary" role="status">{data.notice}</p>{/if}
		{#if form?.error}<p class="error-stamp" role="alert">{form.error}</p>{/if}
		{#if !data.online}
			<p class="error-stamp" role="alert">Comment service unavailable.</p>
		{:else}
			{#each data.items as comment (comment.id)}
				<article class="record comment-moderation">
					<div class="record-header">
						<span class="record-title">{comment.authorName}</span>
						<span class="stamp">{comment.status}</span>
					</div>
					<p>{comment.content}</p>
					<p class="dim">
						{comment.post?.title ?? 'Deleted post'} · {new Date(comment.createdAt).toLocaleString()}
					</p>
					<div class="btn-row">
						{#each ['approved', 'rejected', 'pending'] as status (status)}
							<form method="POST" action="?/moderate&status={data.status}&offset={data.offset}">
								<input type="hidden" name="id" value={comment.id} />
								<input type="hidden" name="status" value={status} />
								<button class="btn" type="submit">{status}</button>
							</form>
						{/each}
						<form method="POST" action="?/delete&status={data.status}&offset={data.offset}">
							<input type="hidden" name="id" value={comment.id} />
							<button class="btn danger" type="submit">DELETE</button>
						</form>
					</div>
				</article>
			{:else}
				<p class="summary">No comments in this queue.</p>
			{/each}
			<nav class="btn-row" aria-label="Comment pagination">
				{#if data.offset > 0}
					<a
						class="btn"
						href="/admin/comments?status={data.status}&offset={Math.max(0, data.offset - 100)}"
						>Previous</a
					>
				{/if}
				{#if data.hasMore}
					<a class="btn" href="/admin/comments?status={data.status}&offset={data.offset + 100}"
						>Next</a
					>
				{/if}
			</nav>
		{/if}
	</main>
</DocShell>
