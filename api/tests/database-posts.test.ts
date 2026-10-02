/**
 * @file database-posts.test.ts
 * @brief Search, scheduling and tag regression coverage without PostgreSQL.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryPosts, createMemoryTags } from '../src/db/memory.js';
import type { PostCreate } from '../src/db/repositories.js';
import { randomUUID } from 'node:crypto';

const NOW = new Date('2026-01-20T12:00:00Z');
const PAST = new Date('2026-01-19T12:00:00Z');
const FUTURE = new Date('2026-01-21T12:00:00Z');

/**
 * @brief Builds a minimal post creation record.
 * @param patch Fields to override.
 * @return The post input.
 */
function post(patch: Partial<PostCreate> = {}): PostCreate {
	const id = randomUUID();
	return {
		id, slug: id, title: 'TypeScript database', description: 'Simple search',
		contentMarkdown: 'PostgreSQL indexing guide', contentHtml: '<p>Guide</p>',
		coverImage: null, status: 'published', authorId: null, publishedAt: PAST, ...patch
	};
}

/**
 * @brief Wires independent in-memory post and tag repositories.
 * @return The repositories.
 */
function repositories() {
	const links = new Map<string, Set<string>>();
	const tags = createMemoryTags(links);
	return { posts: createMemoryPosts(tags, links), tags };
}

describe('post database groundwork', () => {
	it('defaults nullable groundwork fields and maintains generated search data', async () => {
		const { posts } = repositories();
		const row = await posts.create(post());
		expect(row.publishAt).toBeNull();
		expect(row.category).toBeNull();
		const updated = await posts.update(row.id, {
			title: 'Renamed title', searchVector: 'forged', id: randomUUID(), createdAt: FUTURE
		});
		expect(updated?.id).toBe(row.id);
		expect(updated?.createdAt).toEqual(row.createdAt);
		expect(updated?.searchVector).toContain('Renamed title');
		expect(updated?.searchVector).not.toContain('forged');
	});

	it('matches title, description and Markdown words, not substrings or HTML', async () => {
		const { posts } = repositories();
		await posts.create(post());
		const query = { limit: 10, offset: 0, now: NOW };
		for (const search of ['typescript', 'SEARCH', 'postgresql']) {
			expect((await posts.listPublished({ ...query, search })).total).toBe(1);
		}
		for (const search of ['type', 'guide -postgresql', 'p']) {
			expect((await posts.listPublished({ ...query, search })).total).toBe(0);
		}
		expect((await posts.listPublished({ ...query, search: '"indexing guide"' })).total).toBe(1);
		expect((await posts.listPublished({ ...query, search: 'absent OR database' })).total).toBe(1);
		expect((await posts.listPublished({ ...query, search: '   ' })).total).toBe(1);
	});

	it('combines search and tag filtering while counting before pagination', async () => {
		const { posts, tags } = repositories();
		const [tag] = await tags.upsertByName(['database']);
		for (let index = 0; index < 3; index += 1) {
			const row = await posts.create(post({ publishedAt: new Date(PAST.getTime() + index) }));
			if (index < 2) { await tags.setPostTags(row.id, [tag!.id]); }
		}
		const page = await posts.listPublished({
			limit: 1, offset: 1, tag: 'database', search: 'indexing', now: NOW
		});
		expect(page.total).toBe(2);
		expect(page.items).toHaveLength(1);
		expect(page.items[0]?.tags).toEqual(['database']);
		expect((await posts.listPublished({ limit: 10, offset: 0, tag: 'missing', now: NOW })).total).toBe(0);
	});

	it('hides draft, archived, future publication and pending schedule rows', async () => {
		const { posts } = repositories();
		await posts.create(post());
		await posts.create(post({ status: 'draft' }));
		await posts.create(post({ status: 'archived' }));
		await posts.create(post({ publishedAt: FUTURE }));
		await posts.create(post({ publishedAt: null }));
		await posts.create(post({ publishAt: FUTURE }));
		const page = await posts.listPublished({ limit: 10, offset: 0, search: 'database', now: NOW });
		expect(page.total).toBe(1);
		expect(page.items).toHaveLength(1);
	});

	it('publishes only due drafts, preserves scheduled timestamps and is idempotent', async () => {
		const { posts } = repositories();
		const due = await posts.create(post({ status: 'draft', publishedAt: null, publishAt: PAST }));
		const boundary = await posts.create(post({ status: 'draft', publishedAt: null, publishAt: NOW }));
		await posts.create(post({ status: 'draft', publishAt: FUTURE }));
		await posts.create(post({ status: 'draft', publishAt: null }));
		await posts.create(post({ status: 'archived', publishAt: PAST }));
		await posts.create(post({ status: 'published', publishAt: PAST }));
		expect(await posts.publishDue(NOW)).toBe(2);
		expect(await posts.publishDue(NOW)).toBe(0);
		expect(await posts.findById(due.id)).toMatchObject({
			status: 'published', publishedAt: PAST, publishAt: null, updatedAt: NOW
		});
		expect((await posts.findById(boundary.id))?.publishedAt).toEqual(NOW);
	});

	it('deduplicates tag names, slug aliases and repeated links', async () => {
		const { posts, tags } = repositories();
		const row = await posts.create(post());
		const found = await tags.upsertByName(['TypeScript', ' TypeScript ', 'typescript', '', 'typeScript']);
		expect(found).toHaveLength(1);
		await tags.setPostTags(row.id, [found[0]!.id, found[0]!.id]);
		expect(await tags.getPostTagNames(row.id)).toEqual(['TypeScript']);
		const aliases = await tags.upsertByName(['web dev', 'web-dev']);
		expect(aliases).toHaveLength(1);
	});
});
