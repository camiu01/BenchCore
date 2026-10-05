/**
 * @file tag-counts.test.ts
 * @brief Batched tag counts use the same public visibility rules as post listings.
 */
import { describe, expect, it } from 'vitest';
import { createPost } from '../src/posts/post-service.js';
import { createTestRepos } from './helpers.js';

describe('tag counts', () => {
	it('counts visible links once and retains zero-count tags for the administrator catalog', async () => {
		const repos = createTestRepos();
		const now = new Date('2026-10-05T12:00:00Z');
		const visible = await createPost(repos, {
			title: 'Visible', slug: 'visible', contentMarkdown: 'Body.',
			status: 'published', publishedAt: '2020-01-01T00:00:00Z', tags: ['public', 'public', 'shared']
		});
		await createPost(repos, {
			title: 'Draft', slug: 'draft', contentMarkdown: 'Body.', tags: ['draft-only', 'shared']
		});
		await createPost(repos, {
			title: 'Archived', slug: 'archived', contentMarkdown: 'Body.',
			status: 'archived', tags: ['archived-only', 'shared']
		});
		for (const [slug, patch] of [
			['future-date', { publishedAt: new Date('2027-01-01') }],
			['future-schedule', { publishAt: new Date('2027-01-01') }],
			['missing-date', { publishedAt: null }]
		] as const) {
			const post = await createPost(repos, {
				title: slug, slug, contentMarkdown: 'Body.', status: 'published',
				publishedAt: '2020-01-01T00:00:00Z', tags: [slug, 'shared']
			});
			await repos.posts.update(post.id, patch);
		}
		const counts = await repos.posts.listTagCounts(now);
		expect(counts.filter((tag) => tag.count > 0).map((tag) => [tag.name, tag.count]))
			.toEqual([['public', 1], ['shared', 1]]);
		expect(counts.find((tag) => tag.name === 'draft-only')?.count).toBe(0);
		await repos.posts.remove(visible.id);
		expect((await repos.posts.listTagCounts(now)).every((tag) => tag.count === 0)).toBe(true);
	});
});
