/**
 * @file graph-viewport.test.ts
 * @brief Finite graph fitting, distant nodes and sparse-hub focus behavior.
 */
import { describe, expect, it } from 'vitest';
import { graphFit, focusedGraphSlugs } from '../src/lib/graph-viewport.js';

describe('graph viewport', () => {
	it('fits distant nodes and label bounds within the map', () => {
		const points = [
			{ x: -5000, y: -2000, title: 'Left' },
			{ x: 8000, y: 3000, title: 'Right' }
		];
		const fit = graphFit(points);
		expect(fit.scale).toBeLessThan(0.35);
		for (const point of points) {
			expect(point.x * fit.scale + fit.x).toBeGreaterThanOrEqual(48);
			expect((point.x + 12 + point.title.length * 8) * fit.scale + fit.x).toBeLessThanOrEqual(932);
			expect(point.y * fit.scale + fit.y).toBeGreaterThanOrEqual(48);
			expect(point.y * fit.scale + fit.y).toBeLessThanOrEqual(572);
		}
	});

	it('handles empty, single and invalid coordinates without NaN or excessive zoom', () => {
		expect(graphFit([])).toEqual({ x: 0, y: 0, scale: 1 });
		expect(graphFit([{ x: NaN, y: Infinity }])).toEqual({ x: 0, y: 0, scale: 1 });
		const fit = graphFit([{ x: 490, y: 310, title: 'One' }]);
		expect(fit.scale).toBeLessThanOrEqual(2);
		expect(Number.isFinite(fit.x) && Number.isFinite(fit.y)).toBe(true);
	});

	it('includes all shared-topic peers and both wikilink directions in focused views', () => {
		const tag = { name: 'Topic', slug: 'topic', color: '#123456' };
		const node = {
			id: 'id',
			slug: 'hub',
			title: 'Post',
			description: '',
			publishedAt: '2026-01-01T00:00:00Z',
			tags: [tag]
		};
		const graph = {
			nodes: [
				node,
				{ ...node, slug: 'peer' },
				{ ...node, slug: 'leaf' },
				{ ...node, slug: 'linked', tags: [] },
				{ ...node, slug: 'unrelated', tags: [] }
			],
			edges: [
				{ source: 'hub', target: 'peer' },
				{ source: 'hub', target: 'leaf' },
				{ source: 'linked', target: 'leaf' }
			]
		};
		expect(focusedGraphSlugs(graph, 'leaf')).toEqual(new Set(['leaf', 'hub', 'peer', 'linked']));
		expect(focusedGraphSlugs(graph, null)).toBeNull();
		expect(focusedGraphSlugs(graph, 'missing')).toBeNull();
	});
});
