<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
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
	sub="{data.total} record(s) filed under this tag."
	{nav}
	footerLeft="PAGE {data.page} OF {data.totalPages}"
	footerRight="TAG FILTER ACTIVE"
	activeHref="/tags"
>
	<main>
		{#if !data.online}
			<article class="record">
				<div class="record-header">
					<span class="record-title">UPLINK // NO CARRIER</span>
					<span class="stamp">API OFFLINE</span>
				</div>
				<p class="summary">Start the API with <code>pnpm dev:api</code>.</p>
			</article>
		{:else}
			{#each data.items as post (post.id)}
				<article class="record">
					<div class="record-header">
						<span class="record-title">
							<a href="/posts/{encodeURIComponent(post.slug)}">{post.title}</a>
						</span>
						<span class="stamp">PUBLISHED</span>
					</div>
					<p class="summary">{post.description}</p>
				</article>
			{/each}
		{/if}
		{#if data.totalPages > 1}
			<div class="btn-row">
				{#if data.page > 1}
					<a class="btn" href="/tags/{encodeURIComponent(data.tag)}?page={data.page - 1}">← PREV</a>
				{/if}
				{#if data.page < data.totalPages}
					<a class="btn" href="/tags/{encodeURIComponent(data.tag)}?page={data.page + 1}">NEXT →</a>
				{/if}
			</div>
		{/if}
	</main>
</DocShell>
