<!-- @file +page.svelte @brief Public explorer for shared topics and post links. -->
<script lang="ts">
	import DocShell from '../../lib/components/DocShell.svelte';
	import GraphView from '../../lib/components/GraphView.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import type { PageData } from './$types';
	import { authenticationLink } from '../../lib/navigation.js';

	let { data }: { data: PageData } = $props();
	const nav = $derived([
		{ href: '/', label: '[01] index' },
		{ href: '/posts', label: '[02] records' },
		{ href: '/tags', label: '[03] tags' },
		authenticationLink(data.sessionRole, '04')
	]);
</script>

<Seo
	title="Graph | BenchCore"
	description="Explore connections between published BenchCore records."
	canonical="{data.siteBase}/graph"
/>

<DocShell
	docId="FORM: BENCHCORE-2026 // REF: GRAPH"
	title="EXPLORE CONNECTIONS"
	sub="{data.graph.nodes.length} posts · {data.graph.edges
		.length} connections through tags and links"
	{nav}
	footerLeft={data.online ? 'GRAPH: LINKED' : 'GRAPH: OFFLINE'}
	footerRight="FIND A TOPIC · DISCOVER A POST"
	wide
	activeHref="/graph"
>
	<main>
		{#if !data.online}
			<p class="error-stamp" role="alert">
				Connections are temporarily unavailable. Please try again.
			</p>
			<a class="btn" href="/graph">Try again</a>
		{:else if data.graph.nodes.length === 0}
			<article class="record">
				<div class="record-header"><span class="record-title">GRAPH // EMPTY</span></div>
				<p class="summary">There are no published posts to explore yet.</p>
				<a class="btn" href="/posts">Browse posts</a>
			</article>
		{:else}
			<GraphView graph={data.graph} focus={data.focus} />
		{/if}
	</main>
</DocShell>
