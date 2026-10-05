/**
 * @file graph-renderer.test.ts
 * @brief Prototype-safe graph degree calculation regression tests.
 */
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/lib/graph-renderer.js';

describe('graph model', () => {
	it('treats constructor as a normal post slug', () => {
		const graph = {
			nodes: [
				{
					id: '00000000-0000-4000-8000-000000000000',
					slug: 'constructor',
					title: 'Constructor',
					description: '',
					publishedAt: '2026-01-01T00:00:00Z',
					tags: []
				}
			],
			edges: []
		};
		expect(buildModel(graph).nodes[0]?.degree).toBe(0);
		expect(
			buildModel({
				...graph,
				edges: [{ source: 'constructor', target: 'another-post' }]
			}).nodes[0]?.degree
		).toBe(1);
	});
});
