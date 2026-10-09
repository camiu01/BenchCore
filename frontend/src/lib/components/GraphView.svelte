<!-- @file GraphView.svelte @brief Post connections with searchable lists and accessible graph controls. -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { GraphData } from '../api.js';
	import { createGraphRenderer } from '../graph-renderer.js';
	import { matchesGraphNode, relatedGraphNodes } from '../graph-navigation.js';
	import TagChip from './TagChip.svelte';
	import { createPreviewController, type PreviewTarget } from '../linked-previews.js';
	import PostPreviewCard from './PostPreviewCard.svelte';
	import { t } from '../i18n/t.svelte.js';

	interface Props {
		graph: GraphData;
		focus: string | null;
	}
	let { graph, focus }: Props = $props();
	let svg: SVGSVGElement;
	let query = $state('');
	let selection = $state<string | null | undefined>(undefined);
	let focused = $state(false);
	let previewTarget = $state<PreviewTarget | null>(null);
	const previews = createPreviewController((target) => {
		previewTarget = target;
	});
	onDestroy(() => previews.destroy());
	const selectedSlug = $derived(selection === undefined ? focus : selection);
	const selected = $derived(graph.nodes.find((node) => node.slug === selectedSlug) ?? null);
	const results = $derived(graph.nodes.filter((node) => matchesGraphNode(node, query)));
	const related = $derived(relatedGraphNodes(graph, selectedSlug, t));
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
		const controller = createGraphRenderer(svg, graph, selectNode, previews, t);
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
		{t('public.graphView.intro')}
	</p>
	<label class="field-label" for="graph-search">{t('public.graphView.findLabel')}</label>
	<div class="graph-controls">
		<input
			id="graph-search"
			class="field-input"
			type="search"
			bind:value={query}
			oninput={() => searchGraph(query)}
			placeholder={t('public.graphView.searchPlaceholder')}
		/>
		<button
			class="btn"
			type="button"
			aria-label={t('public.graphView.zoomInAria')}
			onclick={() => zoomView(1.4)}>{t('public.graphView.zoomIn')}</button
		>
		<button
			class="btn"
			type="button"
			aria-label={t('public.graphView.zoomOutAria')}
			onclick={() => zoomView(1 / 1.4)}>{t('public.graphView.zoomOut')}</button
		>
		<button class="btn" type="button" onclick={() => resetView()}
			>{t('public.graphView.fit')}</button
		>
		{#if selected}<button class="btn" type="button" aria-pressed={focused} onclick={toggleFocus}
				>{focused ? t('public.graphView.showFull') : t('public.graphView.focus')}</button
			>{/if}
		{#if query}<button class="btn" type="button" onclick={() => searchGraph('')}
				>{t('public.graphView.clearSearch')}</button
			>{/if}
		{#if selectedSlug}<button class="btn" type="button" onclick={() => selectNode(null)}
				>{t('public.graphView.showAll')}</button
			>{/if}
	</div>
</div>
{#if focused && selected}<p class="field-help" role="status">
		{t('public.graphView.focused', { title: selected.title, n: related.length })}
	</p>{/if}

<div class="graph-legend" role="group" aria-label={t('public.graphView.filterGroup')}>
	<button
		class="topic-filter"
		type="button"
		aria-pressed={query === ''}
		onclick={() => searchGraph('')}>{t('public.graphView.allTopics')}</button
	>
	{#each Array.from(new Map(graph.nodes
				.flatMap((node) => node.tags)
				.map((tag) => [tag.slug, tag])).values()).slice(0, 12) as tag (tag.slug)}
		<button
			class="topic-filter"
			type="button"
			aria-pressed={query === tag.name}
			aria-label={t('public.graphView.filterTopic', { tag: tag.name })}
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
			aria-label={t('public.graphView.mapAria')}
		></svg>
	</div>
	<aside class="graph-detail" aria-live="polite">
		{#if selected}
			<p class="field-label">{t('public.graphView.selectedPost')}</p>
			<h2>{selected.title}</h2>
			{#if selected.description}<p>{selected.description}</p>{/if}
			<div class="tag-list">
				{#each selected.tags as tag (tag.slug)}
					<TagChip label={tag.name} color={tag.color} />
				{/each}
			</div>
			<a class="btn btn-accent" href="/posts/{encodeURIComponent(selected.slug)}"
				>{t('public.graphView.readPost')}</a
			>
			<h3>{t('public.graphView.connected', { n: related.length })}</h3>
			<ul class="graph-related">
				{#each related as node (node.slug)}
					<li>
						<a href="/posts/{encodeURIComponent(node.slug)}">{node.title}</a>
						<span>{node.reason}</span>
					</li>
				{:else}
					<li>{t('public.graphView.noConnections')}</li>
				{/each}
			</ul>
		{:else}
			<p class="field-label">{t('public.graphView.start')}</p>
			<p>
				{t('public.graphView.startBody')}
			</p>
			<p>{t('public.graphView.startHint')}</p>
		{/if}
	</aside>
</div>

<section class="graph-fallback" aria-labelledby="graph-results">
	<h2 id="graph-results">{t('public.graphView.browse', { n: results.length })}</h2>
	<p class="muted">{t('public.graphView.browseHint')}</p>
	<ul class="graph-post-list">
		{#each results as node (node.slug)}
			<li>
				<div>
					<a href="/posts/{encodeURIComponent(node.slug)}">{node.title}</a>
					<span>{node.tags.map((tag) => tag.name).join(', ') || t('public.graphView.noTags')}</span>
				</div>
				<button
					class="btn"
					type="button"
					onclick={() => selectNode(node.slug)}
					aria-label={t('public.graphView.showConnectionsFor', { title: node.title })}
					>{t('public.graphView.connections')}</button
				>
			</li>
		{:else}
			<li role="status">{t('public.graphView.noMatch', { query })}</li>
		{/each}
	</ul>
</section>
{#if previewTarget}<PostPreviewCard target={previewTarget} controller={previews} />{/if}

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
