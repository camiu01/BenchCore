<!-- @file GraphView.svelte @brief Interactive published-post wikilink graph with accessible fallback. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { GraphData } from '../api.js';
	import { createGraphRenderer } from '../graph-renderer.js';

	interface Props {
		graph: GraphData;
		focus: string | null;
	}
	let { graph, focus }: Props = $props();
	let svg: SVGSVGElement;
	let query = $state('');
	let selectedSlug = $state<string | null>(null);
	const selected = $derived(graph.nodes.find((node) => node.slug === selectedSlug) ?? null);
	let applyFilter: (query: string) => void = () => undefined;
	let applySelection: (slug: string | null) => void = () => undefined;
	let resetView = () => {};

	/**
	 * @brief Selects a node in both the visual graph and detail panel.
	 * @param slug Node slug or null.
	 * @return Nothing.
	 */
	function selectNode(slug: string | null): void {
		selectedSlug = slug;
		applySelection(slug);
	}

	onMount(() => {
		selectedSlug = focus && graph.nodes.some((node) => node.slug === focus) ? focus : null;
		const controller = createGraphRenderer(svg, graph, selectNode);
		resetView = controller.reset;
		applyFilter = controller.filter;
		applySelection = controller.select;
		applySelection(selectedSlug);
		return controller.destroy;
	});
</script>

<div class="graph-toolbar">
	<label class="field-label" for="graph-search">Search title or tag</label>
	<div class="graph-controls">
		<input
			id="graph-search"
			class="field-input"
			type="search"
			bind:value={query}
			oninput={() => applyFilter(query)}
			placeholder="Type to highlight nodes"
		/>
		<button class="btn" type="button" onclick={() => resetView()}>RESET VIEW</button>
		{#if selectedSlug}<button class="btn" type="button" onclick={() => selectNode(null)}
				>CLEAR FOCUS</button
			>{/if}
	</div>
</div>

<div class="graph-layout">
	<div class="graph-canvas">
		<svg
			bind:this={svg}
			viewBox="0 0 980 620"
			role="img"
			aria-label="Published post connection graph"
		></svg>
	</div>
	<aside class="graph-detail" aria-live="polite">
		{#if selected}
			<p class="field-label">Selected record</p>
			<h2>{selected.title}</h2>
			<p>{selected.description || 'No summary filed.'}</p>
			<div class="tag-list">
				{#each selected.tags as tag (tag.slug)}
					<span class="tag-chip" style:--tag-color={tag.color}>{tag.name}</span>
				{/each}
			</div>
			<a class="btn btn-accent" href="/posts/{encodeURIComponent(selected.slug)}">OPEN POST →</a>
		{:else}
			<p class="field-label">Graph guide</p>
			<p>Select a node to inspect its direct connections. Drag nodes or pan and zoom the canvas.</p>
		{/if}
	</aside>
</div>

<div class="graph-legend" aria-label="Tag color legend">
	{#each Array.from(new Map(graph.nodes
				.flatMap((node) => node.tags)
				.map((tag) => [tag.slug, tag])).values()).slice(0, 12) as tag (tag.slug)}
		<span class="tag-chip" style:--tag-color={tag.color}>{tag.name}</span>
	{/each}
</div>

<details class="graph-fallback">
	<summary>Accessible record index ({graph.nodes.length})</summary>
	<ul>
		{#each graph.nodes as node (node.slug)}
			<li>
				<button type="button" onclick={() => selectNode(node.slug)}>{node.title}</button>
				<span>{node.tags.map((tag) => tag.name).join(', ') || 'untagged'}</span>
			</li>
		{/each}
	</ul>
</details>
