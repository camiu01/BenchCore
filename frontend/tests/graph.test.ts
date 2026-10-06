/**
 * @file graph.test.ts
 * @brief Public graph DTO, loader and accessible fallback coverage.
 */
import { render } from 'svelte/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GraphView from '../src/lib/components/GraphView.svelte';
import { graphSchema } from '../src/lib/api.js';
import { load } from '../src/routes/graph/+page.server.js';
import { matchesGraphNode, relatedGraphNodes } from '../src/lib/graph-navigation.js';

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
		expect(result.body).toContain('Browse posts (1)');
		expect(result.body).toContain('Alpha');
		expect(result.body).toContain('systems');
		expect(result.body).toContain('Read post');
		expect(result.body).toContain('Zoom in');
		expect(result.body).toContain('Filter by topic systems');
		expect(result.body).toContain('href="/posts/alpha"');
	});

	it('matches titles and tags without case or whitespace sensitivity', () => {
		expect(matchesGraphNode(graph.nodes[0]!, ' ALPHA ')).toBe(true);
		expect(matchesGraphNode(graph.nodes[0]!, 'SYSTEMS')).toBe(true);
		expect(matchesGraphNode(graph.nodes[0]!, 'missing')).toBe(false);
		expect(matchesGraphNode(graph.nodes[0]!, '   ')).toBe(true);
	});

	it('lists neighbors from either direction once and explains shared tags', () => {
		const beta = { ...graph.nodes[0]!, slug: 'beta', title: 'Beta' };
		const linked = { ...beta, slug: 'linked', tags: [] };
		const connected = {
			nodes: [...graph.nodes, beta, linked],
			edges: [
				{ source: 'alpha', target: 'beta' },
				{ source: 'beta', target: 'alpha' },
				{ source: 'linked', target: 'alpha' }
			]
		};
		expect(relatedGraphNodes(connected, 'alpha').map((node) => node.reason)).toEqual([
			'Shared topics: systems',
			'Linked in a post'
		]);
		expect(relatedGraphNodes(connected, null)).toEqual([]);
		const result = render(GraphView, { props: { graph: connected, focus: 'alpha' } });
		expect(result.body).toContain('Connected posts (2)');
		expect(result.body).toContain('href="/posts/beta"');
	});

	it('keeps all topic peers discoverable when the map uses a sparse hub', () => {
		const beta = { ...graph.nodes[0]!, slug: 'beta', title: 'Beta' };
		const gamma = { ...beta, slug: 'gamma', title: 'Gamma' };
		const sparse = {
			nodes: [...graph.nodes, beta, gamma],
			edges: [
				{ source: 'alpha', target: 'beta' },
				{ source: 'alpha', target: 'gamma' }
			]
		};
		expect(relatedGraphNodes(sparse, 'beta').map((node) => node.slug)).toEqual(['alpha', 'gamma']);
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
