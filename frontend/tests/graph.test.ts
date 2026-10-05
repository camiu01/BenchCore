/**
 * @file graph.test.ts
 * @brief Public graph DTO, loader and accessible fallback coverage.
 */
import { render } from 'svelte/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GraphView from '../src/lib/components/GraphView.svelte';
import { graphSchema } from '../src/lib/api.js';
import { load } from '../src/routes/graph/+page.server.js';

const graph = {
	nodes: [
		{
			id: '00000000-0000-4000-8000-000000000001',
			slug: 'alpha',
			title: 'Alpha',
			description: 'First record',
			publishedAt: '2026-01-01T00:00:00.000Z',
			tags: [{ name: 'systems', slug: 'systems', color: '#2563EB' }]
		}
	],
	edges: []
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('public graph', () => {
	it('validates and renders an accessible record fallback', () => {
		expect(graphSchema.safeParse(graph).success).toBe(true);
		const result = render(GraphView, { props: { graph, focus: 'alpha' } });
		expect(result.body).toContain('Accessible record index');
		expect(result.body).toContain('Alpha');
		expect(result.body).toContain('systems');
	});

	it('loads graph data and accepts only safe focus slugs', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(graph)));
		const result = await load({
			url: new URL('https://example.test/graph?focus=alpha')
		} as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ graph, focus: 'alpha', online: true });
		const unsafe = await load({
			url: new URL('https://example.test/graph?focus=../private')
		} as Parameters<typeof load>[0]);
		expect(unsafe).toMatchObject({ focus: null });
	});
});
