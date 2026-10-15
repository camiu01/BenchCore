/**
 * @file categories.test.ts
 * @brief Category assignment, filter privacy and non-destructive management regressions.
 */
import { describe, expect, it } from 'vitest';
import { createTestRepos } from './helpers.js';
import { createPost, listPublishedPosts, updatePost } from '../src/posts/post-service.js';

describe('post categories', () => {
	it('filters published posts and never exposes draft-only categories', async () => {
		const deps = createTestRepos();
		await createPost(deps, { title: 'Alpha', slug: 'alpha', category: 'Electronics',
			status: 'published', publishedAt: '2020-01-01T00:00:00Z', contentMarkdown: 'A', tags: ['circuits'] });
		await createPost(deps, { title: 'Secret', slug: 'secret', category: 'Private research', contentMarkdown: 'B' });
		expect(await deps.posts.listCategories()).toEqual([{ name: 'Electronics', count: 1 }]);
		expect(await deps.posts.listCategories(true)).toHaveLength(2);
		expect((await listPublishedPosts(deps, { category: 'Electronics' })).items[0]?.category).toBe('Electronics');
		expect((await listPublishedPosts(deps, { category: 'Private research' })).total).toBe(0);
	});
	it('preserves omitted categories, explicitly clears them and keeps tags separate', async () => {
		const deps = createTestRepos();
		const post = await createPost(deps, { title: 'Alpha', slug: 'alpha', category: 'Theory', contentMarkdown: 'A', tags: ['circuits'] });
		await updatePost(deps, post.id, { title: 'Changed' });
		expect((await deps.posts.findById(post.id))?.category).toBe('Theory');
		expect(await deps.posts.replaceCategory('Theory', 'Physics')).toBe(1);
		expect(await deps.tags.getPostTagNames(post.id)).toEqual(['circuits']);
		expect(await deps.posts.replaceCategory('Physics', null)).toBe(1);
		expect(await deps.posts.findById(post.id)).toMatchObject({ title: 'Changed', category: null });
	});
	it('rejects empty or overlong category assignments', async () => {
		const deps = createTestRepos();
		await expect(createPost(deps, { title: 'A', slug: 'a', contentMarkdown: 'A', category: '' })).rejects.toThrow();
		await expect(createPost(deps, { title: 'A', slug: 'a', contentMarkdown: 'A', category: 'x'.repeat(81) })).rejects.toThrow();
	});
});
