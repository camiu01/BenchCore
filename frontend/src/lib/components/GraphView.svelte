<!-- @file GraphView.svelte @brief Post connections with searchable lists and accessible graph controls. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { GraphData } from '../api.js';
	import { createGraphRenderer } from '../graph-renderer.js';
	import { matchesGraphNode, relatedGraphNodes } from '../graph-navigation.js';
	import TagChip from './TagChip.svelte';

	interface Props {
		graph: GraphData;
		focus: string | null;
	}
	let { graph, focus }: Props = $props();
	let svg: SVGSVGElement;
	let query = $state('');
	let selection = $state<string | null | undefined>(undefined);
	let focused = $state(false);
	const selectedSlug = $derived(selection === undefined ? focus : selection);
	const selected = $derived(graph.nodes.find((node) => node.slug === selectedSlug) ?? null);
	const results = $derived(graph.nodes.filter((node) => matchesGraphNode(node, query)));
	const related = $derived(relatedGraphNodes(graph, selectedSlug));
	let applyFilter: (query: string) => void = () => undefined;
	let applySelection: (slug: string | null) => void = () => undefined;
	let applyFocus: (slug: string | null) => void = () => undefined;
	let resetView = () => {};
	let zoomView: (factor: number) => void = () => undefined;

	/**
	 * @brief Selects a node in both the visual graph and detail panel.
	 * @param slug Node slug or null.
	 * @return Nothing.
	 */
	function selectNode(slug: string | null): void {
		selection = slug;
		applySelection(slug);
		if (slug === null) focused = false;
		applyFocus(focused ? slug : null);
	}

	/** @brief Switches between the complete map and the selected neighborhood. @return Nothing. */
	function toggleFocus(): void {
		focused = !focused;
		applyFocus(focused ? selectedSlug : null);
	}

	/** @brief Applies search from the input or a topic shortcut. @param value Search text. @return Nothing. */
	function searchGraph(value: string): void {
		query = value;
		selectNode(null);
		applyFilter(value);
	}

	onMount(() => {
		const controller = createGraphRenderer(svg, graph, selectNode);
		resetView = controller.reset;
		zoomView = controller.zoom;
		applyFilter = controller.filter;
		applySelection = controller.select;
		applyFocus = controller.focus;
		focused = selected !== null;
		applySelection(selectedSlug);
		applyFilter(query);
		applyFocus(focused ? selectedSlug : null);
		return controller.destroy;
	});
</script>

<div class="graph-toolbar">
	<p class="summary">
		Discover posts that share a topic or link to each other. Select a post to see what connects it
		to the others.
	</p>
	<label class="field-label" for="graph-search">Find a post or topic</label>
	<div class="graph-controls">
		<input
			id="graph-search"
			class="field-input"
			type="search"
			bind:value={query}
			oninput={() => searchGraph(query)}
			placeholder="Search by title or tag"
		/>
		<button class="btn" type="button" aria-label="Zoom in" onclick={() => zoomView(1.4)}
			>Zoom +</button
		>
		<button class="btn" type="button" aria-label="Zoom out" onclick={() => zoomView(1 / 1.4)}
			>Zoom −</button
		>
		<button class="btn" type="button" onclick={() => resetView()}>Fit view</button>
		{#if selected}<button class="btn" type="button" aria-pressed={focused} onclick={toggleFocus}
				>{focused ? 'Show full map' : 'Focus connections'}</button
			>{/if}
		{#if query}<button class="btn" type="button" onclick={() => searchGraph('')}
				>Clear search</button
			>{/if}
		{#if selectedSlug}<button class="btn" type="button" onclick={() => selectNode(null)}
				>Show all connections</button
			>{/if}
	</div>
</div>
{#if focused && selected}<p class="field-help" role="status">
		Focused on {selected.title} and {related.length} connected posts.
	</p>{/if}

<div class="graph-legend" role="group" aria-label="Filter by topic">
	<button
		class="topic-filter"
		type="button"
		aria-pressed={query === ''}
		onclick={() => searchGraph('')}>All topics</button
	>
	{#each Array.from(new Map(graph.nodes
				.flatMap((node) => node.tags)
				.map((tag) => [tag.slug, tag])).values()).slice(0, 12) as tag (tag.slug)}
		<button
			class="topic-filter"
			type="button"
			aria-pressed={query === tag.name}
			aria-label="Filter by topic {tag.name}"
			onclick={() => searchGraph(tag.name)}
		>
			<TagChip label={tag.name} color={tag.color} />
		</button>
	{/each}
</div>

<div class="graph-layout">
	<div class="graph-canvas">
		<svg
			bind:this={svg}
			viewBox="0 0 980 620"
			role="group"
			aria-label="Published post connection graph"
		></svg>
	</div>
	<aside class="graph-detail" aria-live="polite">
		{#if selected}
			<p class="field-label">Selected post</p>
			<h2>{selected.title}</h2>
			{#if selected.description}<p>{selected.description}</p>{/if}
			<div class="tag-list">
				{#each selected.tags as tag (tag.slug)}
					<TagChip label={tag.name} color={tag.color} />
				{/each}
			</div>
			<a class="btn btn-accent" href="/posts/{encodeURIComponent(selected.slug)}">Read post →</a>
			<h3>Connected posts ({related.length})</h3>
			<ul class="graph-related">
				{#each related as node (node.slug)}
					<li>
						<a href="/posts/{encodeURIComponent(node.slug)}">{node.title}</a>
						<span>{node.reason}</span>
					</li>
				{:else}
					<li>No connections yet. Try another post from the list below.</li>
				{/each}
			</ul>
		{:else}
			<p class="field-label">Start exploring</p>
			<p>
				Choose a dot on the map or a title in the list below. Each dot is a post; each line is a
				shared topic or a link.
			</p>
			<p>Move the map by dragging its background. Use the zoom buttons to get a closer look.</p>
		{/if}
	</aside>
</div>

<section class="graph-fallback" aria-labelledby="graph-results">
	<h2 id="graph-results">Browse posts ({results.length})</h2>
	<p class="muted">Use the list instead of the map, or open a post directly.</p>
	<ul class="graph-post-list">
		{#each results as node (node.slug)}
			<li>
				<div>
					<a href="/posts/{encodeURIComponent(node.slug)}">{node.title}</a>
					<span>{node.tags.map((tag) => tag.name).join(', ') || 'No tags'}</span>
				</div>
				<button
					class="btn"
					type="button"
					onclick={() => selectNode(node.slug)}
					aria-label="Show connections for {node.title}">Connections</button
				>
			</li>
		{:else}
			<li role="status">No posts match “{query}”. Try another title or tag.</li>
		{/each}
	</ul>
</section>

<style>
	.graph-controls {
		flex-wrap: wrap;
	}
	.graph-controls .btn {
		min-height: 44px;
	}
	.graph-detail h3,
	.graph-fallback h2 {
		font-size: 16px;
		margin-top: 24px;
	}
	.graph-related,
	.graph-post-list {
		list-style: none;
		padding: 0;
	}
	.graph-related li {
		margin-top: 16px;
	}
	.graph-related span,
	.graph-post-list span {
		display: block;
		color: var(--muted);
		font-size: 12px;
		margin-top: 4px;
	}
	.graph-post-list li {
		align-items: center;
		padding: 12px 0;
		border-bottom: 1px solid var(--border-light);
	}
	.graph-post-list a,
	.graph-related a {
		display: inline-block;
		padding: 8px 0;
	}
	.graph-fallback .graph-post-list button {
		padding: 8px 12px;
		border: 1px solid var(--border);
		min-height: 44px;
	}
	@media (max-width: 640px) {
		.graph-canvas {
			min-height: 280px;
		}
		.graph-canvas svg {
			height: 45vh;
			min-height: 280px;
		}
	}
</style>
