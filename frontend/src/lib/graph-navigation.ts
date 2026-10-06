/**
 * @file graph-navigation.ts
 * @brief Search and related-post projections for accessible graph navigation.
 */
import type { GraphData } from './api.js';

/** @brief Matches a post title or tag. @param node Graph post. @param query Search text. @return Whether the post matches. */
export function matchesGraphNode(node: GraphData['nodes'][number], query: string): boolean {
	const needle = query.trim().toLowerCase();
	return (
		node.title.toLowerCase().includes(needle) ||
		node.tags.some((tag) => tag.name.toLowerCase().includes(needle))
	);
}

/** @brief Finds connected posts and explains shared topics. @param graph Public graph. @param slug Selected slug. @return Connected posts with connection labels. */
export function relatedGraphNodes(graph: GraphData, slug: string | null) {
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
					? `Shared topics: ${shared.map((tag) => tag.name).join(', ')}`
					: 'Linked in a post'
			};
		});
}
