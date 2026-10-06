<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { PageData } from './$types';
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import { authenticationLink } from '../../lib/navigation.js';
	import ReaderGate from '../../lib/components/ReaderGate.svelte';
	import { publicationDate } from '../../lib/presentation.js';

	let { data }: { data: PageData } = $props();

	const nav = $derived([
		{ href: '/', label: '[01] index' },
		{ href: '/tags', label: '[02] tags' },
		{ href: '/graph', label: '[03] graph' },
		authenticationLink(data.sessionRole, '04')
	]);
</script>

<Seo
	title="Posts | BenchCore"
	description="Browse and search published posts, newest first."
	canonical="{data.siteBase}/posts"
/>

<DocShell
	docId="FORM: BENCHCORE-2026 // REF: RECORDS"
	title="POSTS"
	sub="{data.total} posts, newest first. Search by title or content."
	{nav}
	footerLeft="PAGE {data.page} OF {data.totalPages}"
	footerRight="PER PAGE: {data.perPage}"
	activeHref="/posts"
>
	<main>
		<form method="GET" action="/posts" class="form-grid">
			<label class="field-label" for="search">Search posts</label>
			<input
				class="field-input"
				id="search"
				name="search"
				type="search"
				maxlength="200"
				value={data.search}
				placeholder="Enter a title or keyword"
			/>
			<div class="btn-row">
				<button class="btn" type="submit">SEARCH</button>
				{#if data.search}<a class="btn" href="/posts">Clear search</a>{/if}
			</div>
		</form>
		{#if !data.online}
			<article class="record">
				<div class="record-header">
					<span class="record-title">Posts temporarily unavailable</span>
				</div>
				<p class="summary">We cannot load posts right now. Please try again in a moment.</p>
				<a class="btn" href="/posts?search={encodeURIComponent(data.search)}">Try again</a>
			</article>
		{:else if data.items.length === 0}
			<article class="record">
				<div class="record-header">
					<span class="record-title"
						>{data.search ? 'No matching posts' : 'No posts on this page'}</span
					>
				</div>
				<p class="summary">
					{data.search
						? 'Try a different keyword or clear the search to see all posts.'
						: 'New posts will appear here when they are published.'}
				</p>
				{#if data.search || data.page > 1}<a class="btn" href="/posts">Show all posts</a>{/if}
			</article>
		{:else}
			{#each data.items as post (post.id)}
				<article class="record">
					<div class="record-header">
						<span class="record-title">
							<a href="/posts/{encodeURIComponent(post.slug)}">{post.title}</a>
						</span>
						<span class="stamp">{post.audience === 'readers' ? 'READERS ONLY' : 'PUBLISHED'}</span>
					</div>
					{#if post.locked}<ReaderGate slug={post.slug} />{:else}<p class="summary">
							{post.description}
						</p>{/if}
					<table class="spec-table">
						<tbody>
							<tr>
								<td class="label">PUBLISHED</td>
								<td
									><time datetime={post.publishedAt ?? undefined}
										>{publicationDate(post.publishedAt)}</time
									></td
								>
							</tr>
							{#if post.tags.length > 0}
								<tr>
									<td class="label">TAGS</td>
									<td>
										{#each post.tags as tag, index (tag)}<a href="/tags/{encodeURIComponent(tag)}"
												>{tag}</a
											>{#if index < post.tags.length - 1},
											{/if}{/each}
									</td>
								</tr>
							{/if}
						</tbody>
					</table>
				</article>
			{/each}
		{/if}
		{#if data.totalPages > 1}
			<nav class="btn-row" aria-label="Post pages">
				<span class="page-position">Page {data.page} of {data.totalPages}</span>
				{#if data.page > 1}
					<a class="btn" href="/posts?page={data.page - 1}&search={encodeURIComponent(data.search)}"
						>← Previous</a
					>
				{/if}
				{#if data.page < data.totalPages}
					<a class="btn" href="/posts?page={data.page + 1}&search={encodeURIComponent(data.search)}"
						>NEXT →</a
					>
				{/if}
			</nav>
		{/if}
	</main>
</DocShell>
