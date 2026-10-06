<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { PageData } from './$types';
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import TagChip from '../../lib/components/TagChip.svelte';
	import { authenticationLink } from '../../lib/navigation.js';

	let { data }: { data: PageData } = $props();

	const nav = $derived([
		{ href: '/', label: '[01] index' },
		{ href: '/posts', label: '[02] records' },
		{ href: '/graph', label: '[03] graph' },
		authenticationLink(data.sessionRole, '04')
	]);
</script>

<Seo
	title="Topics | BenchCore"
	description="Find posts by topic."
	canonical="{data.siteBase}/tags"
/>

<DocShell
	docId="FORM: BENCHCORE-2026 // REF: TAGS"
	title="EXPLORE BY TOPIC"
	sub="Choose a tag to see posts about that topic."
	{nav}
	footerLeft="TAGS: {data.items.length}"
	footerRight="INDEX COMPLETE"
	activeHref="/tags"
>
	<main>
		{#if !data.online}
			<article class="record">
				<div class="record-header">
					<span class="record-title">Topics temporarily unavailable</span>
				</div>
				<p class="summary">We cannot load topics right now. Please try again in a moment.</p>
				<a class="btn" href="/tags">Try again</a>
			</article>
		{:else if data.items.length === 0}
			<p class="summary">There are no topics yet. You can browse all published posts instead.</p>
			<a class="btn" href="/posts">Browse posts</a>
		{:else}
			<ul class="topic-grid" aria-label="Topics">
				{#each data.items as tag (tag.slug)}
					<li>
						<a class="topic-card" href="/tags/{encodeURIComponent(tag.name)}">
							<TagChip label={tag.name} color={tag.color} />
							<span class="topic-count">{tag.count} {tag.count === 1 ? 'post' : 'posts'}</span>
							<span class="topic-open">Explore →</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</main>
</DocShell>
