/**
 * @file graph.test.ts
 * @brief Shared-tag graph connections and publication boundary regressions.
 */
import { describe, expect, it } from 'vitest';
import { buildPublicGraph } from '../src/posts/graph-service.js';
import { createPost } from '../src/posts/post-service.js';
import { createTestRepos } from './helpers.js';

describe('shared-tag graph', () => {
	it('connects every published pair once across multiple shared tags', async () => {
		const repos = createTestRepos();
		for (const slug of ['alpha', 'beta', 'gamma']) {
			await createPost(repos, {
				title: slug, slug, status: 'published', publishedAt: '2020-01-01T00:00:00Z',
				contentMarkdown: 'No wikilinks.', tags: ['systems', 'design']
			});
		}
		const graph = await buildPublicGraph(repos.posts, repos.tags);
		expect(graph.edges).toHaveLength(3);
		expect(new Set(graph.edges.map((edge) => [edge.source, edge.target].sort().join(':'))))
			.toEqual(new Set(['alpha:beta', 'alpha:gamma', 'beta:gamma']));
	});

	it('does not duplicate a reverse wikilink or include unpublished peers', async () => {
		const repos = createTestRepos();
		for (const slug of ['alpha', 'beta', 'draft', 'archived', 'future', 'unrelated']) {
			await createPost(repos, {
				title: slug, slug,
				status: slug === 'draft' ? 'draft' : slug === 'archived' ? 'archived' : 'published',
				publishedAt: slug === 'future' ? '2099-01-01T00:00:00Z' : '2020-01-01T00:00:00Z',
				contentMarkdown: slug === 'alpha' ? 'See [[beta]].' : 'Body.',
				tags: slug === 'unrelated' ? ['other'] : ['systems']
			});
		}
		const graph = await buildPublicGraph(repos.posts, repos.tags);
		expect(graph.nodes.map((node) => node.slug).sort()).toEqual(['alpha', 'beta', 'unrelated']);
		expect(graph.edges).toEqual([{ source: 'alpha', target: 'beta' }]);
	});

	it('keeps large topic groups connected with linear edge growth', async () => {
		const repos = createTestRepos();
		for (let index = 0; index < 100; index += 1) {
			await createPost(repos, {
				title: `Post ${index}`, slug: `post-${index}`, status: 'published',
				publishedAt: '2020-01-01T00:00:00Z', contentMarkdown: 'Body.', tags: ['large-topic']
			});
		}
		const graph = await buildPublicGraph(repos.posts, repos.tags);
		expect(graph.edges).toHaveLength(99);
		expect(new Set(graph.edges.flatMap((edge) => [edge.source, edge.target])).size).toBe(100);
		expect(new Set(graph.edges.map((edge) => edge.source)).size).toBe(1);
	});
});
