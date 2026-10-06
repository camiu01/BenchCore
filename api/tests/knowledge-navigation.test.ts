/**
 * @file knowledge-navigation.test.ts
 * @brief Multi-tag filters, privacy-preserving popularity and bounded published previews.
 */
import { describe, expect, it } from 'vitest';
import { createPost, listPublishedPosts } from '../src/posts/post-service.js';
import { getPublishedPreview } from '../src/posts/post-preview.js';
import { parsePublishedQuery } from '../src/posts/list-query.js';
import { createTestRepos } from './helpers.js';

describe('knowledge navigation', () => {
	it('validates repeated and legacy tags, deduplicates values and bounds every filter', () => {
		expect(parsePublishedQuery(new URLSearchParams('tag=one&tag=one&tags=two&tagMode=or&sort=popular')).data)
			.toMatchObject({ tags: ['one', 'two'], tagMode: 'or', sort: 'popular' });
		for (const query of ['sort=views', 'tagMode=x', 'tag=', 'offset=1000001',
			Array.from({ length: 21 }, (_, index) => `tag=t${index}`).join('&')]) {
			expect(parsePublishedQuery(new URLSearchParams(query)).success).toBe(false);
		}
	});

	it('combines AND/OR with search and counts before deterministic pagination', async () => {
		const repos = createTestRepos();
		for (const [slug, tags] of [['both', ['one', 'two']], ['single', ['one']], ['other', ['three']]] as const) {
			await createPost(repos, { slug, title: slug, tags: [...tags], status: 'published',
				contentMarkdown: 'searchable body', publishedAt: '2020-01-01T00:00:00Z' });
		}
		const query = { tags: ['one', 'two'], search: 'searchable', limit: 1, offset: 0 };
		const both = await listPublishedPosts(repos, { ...query, tagMode: 'and' });
		expect(both.total).toBe(1); expect(both.items[0]?.slug).toBe('both');
		expect((await listPublishedPosts(repos, { ...query, tagMode: 'or', offset: 1 })).total).toBe(2);
		expect((await listPublishedPosts(repos, { tags: ['one', 'missing'], tagMode: 'and' })).total).toBe(0);
	});

	it('sorts by updates and existing likes, redacting restricted engagement counts and rank', async () => {
		const repos = createTestRepos();
		const older = await createPost(repos, { slug: 'older', title: 'Older', contentMarkdown: 'Body',
			status: 'published', publishedAt: '2020-01-01T00:00:00Z' });
		const newer = await createPost(repos, { slug: 'newer', title: 'Newer', contentMarkdown: 'Body',
			status: 'published', publishedAt: '2021-01-01T00:00:00Z' });
		const restricted = await createPost(repos, { slug: 'private', title: 'Private', contentMarkdown: 'privateword',
			audience: 'readers', status: 'published', publishedAt: '2019-01-01T00:00:00Z' });
		for (let index = 0; index < 5; index++) await repos.likes.toggle(restricted.id, `fixture-${index}`);
		await repos.likes.toggle(older.id, 'fixture');
		expect((await listPublishedPosts(repos, { sort: 'popular' })).items.map((row) => row.slug)).toEqual(['older', 'newer', 'private']);
		expect((await listPublishedPosts(repos, { sort: 'popular' })).items[2]?.likesCount).toBe(0);
		expect((await listPublishedPosts({ ...repos, viewerRole: 'reader' }, { sort: 'popular' })).items[0]?.likesCount).toBe(5);
		const olderRow = await repos.posts.findById(older.id);
		const newerRow = await repos.posts.findById(newer.id);
		if (!olderRow || !newerRow) throw new Error('Missing rows');
		olderRow.updatedAt = new Date('2030-01-01T00:00:00Z');
		newerRow.updatedAt = new Date('2020-01-01T00:00:00Z');
		expect((await listPublishedPosts(repos, { sort: 'updated' })).items[0]?.slug).toBe('older');
		expect((await listPublishedPosts(repos, { search: 'privateword', sort: 'popular' })).total).toBe(0);
	});

	it('masks unpublished targets and never sends protected descriptions, covers or Markdown', async () => {
		const repos = createTestRepos();
		for (const status of ['draft', 'archived'] as const) {
			await createPost(repos, { title: status, slug: status, status, contentMarkdown: 'secretbody' });
			expect(await getPublishedPreview({ ...repos, viewerRole: 'admin' }, status)).toBeNull();
		}
		await createPost(repos, { title: 'Private', slug: 'private', status: 'published', audience: 'readers',
			contentMarkdown: 'secretbody', description: 'secretdescription', coverImage: 'https://example.test/private.png' });
		expect(await getPublishedPreview(repos, 'private')).toMatchObject({ locked: true, description: '', coverImage: null });
		const visible = await getPublishedPreview({ ...repos, viewerRole: 'reader' }, 'private');
		expect(visible).toMatchObject({ locked: false, description: 'secretdescription' });
		expect(JSON.stringify(visible)).not.toContain('secretbody');
		expect(await getPublishedPreview(repos, 'missing')).toBeNull();
	});
});
