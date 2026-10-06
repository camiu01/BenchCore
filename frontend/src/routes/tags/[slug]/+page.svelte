<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import ReaderGate from '../../../lib/components/ReaderGate.svelte';
	import type { PageData } from './$types';
	import DocShell from '../../../lib/components/DocShell.svelte';
	import Seo from '../../../lib/components/Seo.svelte';

	let { data }: { data: PageData } = $props();

	const nav = [
		{ href: '/', label: '[01] index' },
		{ href: '/posts', label: '[02] records' },
		{ href: '/tags', label: '[03] tags' }
	];
</script>

<Seo
	title="Tag {data.tag} | BenchCore"
	description="Records filed under {data.tag}."
	canonical="{data.siteBase}/tags/{encodeURIComponent(data.tag)}"
/>

<DocShell
	docId="FORM: BENCHCORE-2026 // REF: TAG-{data.tag.toUpperCase()}"
	title="TAG // {data.tag}"
	sub="{data.total} posts about this topic."
	{nav}
	footerLeft="PAGE {data.page} OF {data.totalPages}"
	footerRight="TAG FILTER ACTIVE"
	activeHref="/tags"
>
	<main>
		<p><a href="/tags">← All topics</a></p>
		{#if !data.online}
			<article class="record">
				<div class="record-header">
					<span class="record-title">Posts temporarily unavailable</span>
				</div>
				<p class="summary">We cannot load posts right now. Please try again in a moment.</p>
				<a class="btn" href="/tags/{encodeURIComponent(data.tag)}">Try again</a>
			</article>
		{:else if data.items.length === 0}
			<p class="summary">
				There are no posts on this page. Choose another topic or browse all posts.
			</p>
			<a class="btn" href="/posts">Browse posts</a>
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
				</article>
			{/each}
		{/if}
		{#if data.totalPages > 1}
			<nav class="btn-row" aria-label="Topic pages">
				<span class="page-position">Page {data.page} of {data.totalPages}</span>
				{#if data.page > 1}
					<a class="btn" href="/tags/{encodeURIComponent(data.tag)}?page={data.page - 1}"
						>← Previous</a
					>
				{/if}
				{#if data.page < data.totalPages}
					<a class="btn" href="/tags/{encodeURIComponent(data.tag)}?page={data.page + 1}">NEXT →</a>
				{/if}
			</nav>
		{/if}
	</main>
</DocShell>
