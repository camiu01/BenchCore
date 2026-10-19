/**
 * @file graph-navigation.ts
 * @brief Search and related-post projections for accessible graph navigation.
 */
import type { GraphData } from './api.js';
import { DEFAULT_LOCALE } from './i18n/locale.js';
import { translator } from './i18n/translate.js';

/** @brief Reads shareable filters and selection, accepting legacy focus links. @param url Current page URL. @param fallback Initial selection outside the graph route. @return Graph presentation state. */
export function graphLocation(
	url: { pathname: string; searchParams: Pick<URLSearchParams, 'get'> },
	fallback: string | null = null
) {
	const requested = url.searchParams.get('focus');
	const slug = requested && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requested) ? requested : null;
	const selected = url.pathname === '/graph' ? slug : fallback;
	return {
		query: url.searchParams.get('q') ?? '',
		slug: selected,
		focused: selected !== null && url.searchParams.get('view') !== 'all'
	};
}

/** @brief Updates only graph parameters without changing unrelated URL state. @param current Current URL. @param state Graph presentation state. @return Shareable graph URL. */
export function graphLocationUrl(
	current: Pick<URL, 'href'>,
	state: ReturnType<typeof graphLocation>
): URL {
	const url = new URL(current.href);
	for (const [key, value] of [
		['q', state.query],
		['focus', state.slug ?? ''],
		['view', state.slug && !state.focused ? 'all' : '']
	] as const) {
		if (value) url.searchParams.set(key, value);
		else url.searchParams.delete(key);
	}
	return url;
}

/** @brief Matches a post title or tag. @param node Graph post. @param query Search text. @return Whether the post matches. */
export function matchesGraphNode(node: GraphData['nodes'][number], query: string): boolean {
	const needle = query.trim().toLowerCase();
	return (
		node.title.toLowerCase().includes(needle) ||
		node.tags.some((tag) => tag.name.toLowerCase().includes(needle))
	);
}

/** @brief Finds connected posts and explains shared topics. @param graph Public graph. @param slug Selected slug. @param tr Message translator. @return Connected posts with connection labels. */
export function relatedGraphNodes(
	graph: GraphData,
	slug: string | null,
	tr: ReturnType<typeof translator> = translator(DEFAULT_LOCALE)
) {
	const selected = graph.nodes.find((node) => node.slug === slug);
	if (!selected) return [];
	const neighbors = new Set<string>();
	const topics = new Set(selected.tags.map((tag) => tag.slug));
	for (const edge of graph.edges) {
		if (edge.source === slug) neighbors.add(edge.target);
		if (edge.target === slug) neighbors.add(edge.source);
	}
	return graph.nodes
		.filter(
			(node) =>
				node.slug !== slug &&
				(neighbors.has(node.slug) || node.tags.some((tag) => topics.has(tag.slug)))
		)
		.map((node) => {
			const shared = node.tags.filter((tag) =>
				selected.tags.some((item) => item.slug === tag.slug)
			);
			return {
				...node,
				reason: shared.length
					? tr('public.graph.reasonShared', { topics: shared.map((tag) => tag.name).join(', ') })
					: tr('public.graph.reasonLinked')
			};
		});
}
