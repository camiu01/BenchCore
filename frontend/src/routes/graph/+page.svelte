<!-- @file +page.svelte @brief Public interactive graph of published post wikilinks. -->
<script lang="ts">
	import DocShell from '../../lib/components/DocShell.svelte';
	import GraphView from '../../lib/components/GraphView.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const nav = [
		{ href: '/', label: '[01] index' },
		{ href: '/posts', label: '[02] records' },
		{ href: '/tags', label: '[03] tags' },
		{ href: '/account', label: '[04] account' }
	];
</script>

<Seo
	title="Graph | BenchCore"
	description="Explore connections between published BenchCore records."
	canonical="{data.siteBase}/graph"
/>

<DocShell
	docId="FORM: BENCHCORE-2026 // REF: GRAPH"
	title="KNOWLEDGE GRAPH"
	sub="{data.graph.nodes.length} published records · {data.graph.edges.length} wikilinks"
	{nav}
	footerLeft={data.online ? 'GRAPH: LINKED' : 'GRAPH: OFFLINE'}
	footerRight="DRAG + ZOOM + SEARCH"
	wide
	activeHref="/graph"
>
	<main>
		{#if !data.online}
			<p class="error-stamp" role="alert">The graph API is unavailable. Please retry.</p>
		{:else if data.graph.nodes.length === 0}
			<article class="record">
				<div class="record-header"><span class="record-title">GRAPH // EMPTY</span></div>
				<p class="summary">Publish records to build the graph.</p>
			</article>
		{:else}
			<GraphView graph={data.graph} focus={data.focus} />
		{/if}
	</main>
</DocShell>
