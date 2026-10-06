/**
 * @file graph-viewport.ts
 * @brief Pure graph bounds and focused-neighborhood calculations.
 */
import type { GraphData } from './api.js';
import { relatedGraphNodes } from './graph-navigation.js';

export interface GraphPoint {
	x?: number | undefined;
	y?: number | undefined;
	title?: string;
}

/** @brief Includes tag peers even when a dense tag uses sparse hub edges. @param graph Public graph. @param slug Selected post. @return Visible slugs or unrestricted view. */
export function focusedGraphSlugs(graph: GraphData, slug: string | null): Set<string> | null {
	if (!slug || !graph.nodes.some((node) => node.slug === slug)) return null;
	return new Set([slug, ...relatedGraphNodes(graph, slug).map((node) => node.slug)]);
}

/** @brief Fits finite node and approximate label bounds into an SVG viewBox. @param points Positioned nodes. @param width View width. @param height View height. @return Finite translation and scale. */
export function graphFit(points: GraphPoint[], width = 980, height = 620) {
	const valid = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
	if (!valid.length || width <= 0 || height <= 0) return { x: 0, y: 0, scale: 1 };
	let left = Infinity,
		right = -Infinity,
		top = Infinity,
		bottom = -Infinity;
	for (const point of valid) {
		const x = point.x ?? 0,
			y = point.y ?? 0;
		left = Math.min(left, x - 24);
		right = Math.max(right, x + 12 + Math.min(point.title?.length ?? 0, 38) * 8);
		top = Math.min(top, y - 24);
		bottom = Math.max(bottom, y + 24);
	}
	const scale = Math.max(
		0.01,
		Math.min(2, (width - 96) / Math.max(right - left, 1), (height - 96) / Math.max(bottom - top, 1))
	);
	return {
		x: width / 2 - (scale * (left + right)) / 2,
		y: height / 2 - (scale * (top + bottom)) / 2,
		scale
	};
}
