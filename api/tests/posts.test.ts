/**
 * @file posts.test.ts
 * @brief Service tests against in-memory repositories (no database).
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PostServiceDeps } from '../src/posts/post-service.js';
import { importDirectory } from '../src/posts/import-service.js';
import {
	createPost,
	deletePost,
	getPublishedPost,
	listPublishedPosts,
	PostError,
	updatePost
} from '../src/posts/post-service.js';
import { createTestRepos, type TestRepos } from './helpers.js';
import { buildPublicGraph } from '../src/posts/graph-service.js';

let repos: TestRepos;
let deps: PostServiceDeps;

beforeEach(() => {
	repos = createTestRepos();
	deps = { posts: repos.posts, tags: repos.tags, users: repos.users };
});

/**
 * @brief Seeds one published and one draft post.
 */
async function seedPair(): Promise<void> {
	await createPost(deps, {
		title: 'Alpha',
		slug: 'alpha',
		status: 'published',
		publishedAt: '2020-01-01T00:00:00Z',
		contentMarkdown: 'Links to [[beta]].',
		tags: ['one']
	});
	await createPost(deps, {
		title: 'Beta',
		slug: 'beta',
		status: 'draft',
		contentMarkdown: 'Draft body.'
	});
}

describe('post service', () => {
	it('lists only published posts and masks drafts as 404', async () => {
		await seedPair();
		const page = await listPublishedPosts(deps, {});
		expect(page.total).toBe(1);
		expect(page.items[0]?.slug).toBe('alpha');
		expect(await getPublishedPost(deps, 'beta')).toBeNull();
	});

	it('exposes backlinks on published posts', async () => {
		await createPost(deps, {
			title: 'Target',
			slug: 'target',
			status: 'published',
			publishedAt: '2020-01-01T00:00:00Z',
			contentMarkdown: 'Body.'
		});
		await createPost(deps, {
			title: 'Referrer',
			slug: 'referrer',
			status: 'published',
			publishedAt: '2020-01-02T00:00:00Z',
			contentMarkdown: 'See [[target]].'
		});
		const detail = await getPublishedPost(deps, 'target');
		expect(detail?.backlinks).toEqual([{ slug: 'referrer', title: 'Referrer' }]);
	});

	it('builds a deduplicated graph without draft or broken targets', async () => {
		await createPost(deps, {
			title: 'Target', slug: 'target', status: 'published',
			publishedAt: '2020-01-01T00:00:00Z', contentMarkdown: 'Body.', tags: ['graph']
		});
		await createPost(deps, {
			title: 'Source', slug: 'source', status: 'published',
			publishedAt: '2020-01-02T00:00:00Z',
			contentMarkdown: 'See [[target]], [[target]] and [[missing]].'
		});
		await createPost(deps, {
			title: 'Draft', slug: 'draft', status: 'draft', contentMarkdown: 'See [[target]].'
		});
		const graphTag = (await repos.tags.list()).find((tag) => tag.name === 'graph')!;
		await repos.tags.updateColor(graphTag.id, '#2563EB');
		const graph = await buildPublicGraph(repos.posts, repos.tags, new Date('2021-01-01T00:00:00Z'));
		expect(graph.nodes.map((node) => node.slug)).toEqual(['source', 'target']);
		expect(graph.nodes.find((node) => node.slug === 'target')?.tags[0]?.color).toBe('#2563EB');
		expect(graph.edges).toEqual([{ source: 'source', target: 'target' }]);
	});

	it('rejects duplicate slugs and invalid payloads', async () => {
		await seedPair();
		await expect(createPost(deps, { title: 'X', slug: 'alpha', contentMarkdown: 'x' })).rejects.toBeInstanceOf(
			PostError
		);
		await expect(createPost(deps, { title: 'X', slug: 'Bad Slug', contentMarkdown: 'x' })).rejects.toBeInstanceOf(
			PostError
		);
	});

	it('updates, transitions and deletes posts', async () => {
		await seedPair();
		const beta = await repos.posts.findBySlug('beta');
		if (beta === null) {
			throw new Error('seed failed');
		}
		const published = await updatePost(deps, beta.id, { status: 'published' });
		expect(published.slug).toBe('beta');
		expect((await listPublishedPosts(deps, {})).total).toBe(2);
		expect(await deletePost(deps, beta.id)).toBe(true);
		expect(await deletePost(deps, beta.id)).toBe(false);
		await expect(updatePost(deps, 'missing', { title: 'x' })).rejects.toBeInstanceOf(PostError);
	});

	it('publishes due drafts once and never publishes archived or future posts', async () => {
		const due = await createPost(deps, {
			title: 'Scheduled', slug: 'scheduled', contentMarkdown: 'Body.', publishAt: '2020-01-01T00:00:00Z'
		});
		await createPost(deps, {
			title: 'Future', slug: 'future', contentMarkdown: 'Body.', publishAt: '2099-01-01T00:00:00Z'
		});
		expect(await getPublishedPost(deps, 'scheduled')).toBeNull();
		expect(await repos.posts.publishDue(new Date('2021-01-01T00:00:00Z'))).toBe(1);
		expect(await repos.posts.publishDue(new Date('2021-01-01T00:00:00Z'))).toBe(0);
		expect((await repos.posts.findById(due.id))?.publishAt).toBeNull();
		expect((await getPublishedPost(deps, 'scheduled'))?.publishedAt).toBe('2020-01-01T00:00:00.000Z');
		expect(await getPublishedPost(deps, 'future')).toBeNull();
	});

	it('validates schedules, allows cancellation and stamps published null dates', async () => {
		await expect(createPost(deps, {
			title: 'Invalid', slug: 'invalid', contentMarkdown: 'x', status: 'published', publishAt: '2099-01-01T00:00:00Z'
		})).rejects.toBeInstanceOf(PostError);
		const post = await createPost(deps, {
			title: 'Schedule', slug: 'schedule', contentMarkdown: 'x', publishAt: '2020-01-01T00:00:00Z', coverImage: '/old.png'
		});
		await updatePost(deps, post.id, { publishAt: null, coverImage: null, status: 'published', publishedAt: null });
		const row = await repos.posts.findById(post.id);
		expect(row?.publishAt).toBeNull();
		expect(row?.coverImage).toBeNull();
		expect(row?.publishedAt).toBeInstanceOf(Date);
	});

	it('prefixes relative media sources on public detail reads', async () => {
		await createPost(deps, { title: 'Image', slug: 'image', status: 'published', contentMarkdown: '![Photo](photo.png)' });
		expect((await getPublishedPost(deps, 'image'))?.contentHtml).toContain('src="/api/media/photo.png"');
	});

	it('returns canonical tags and rejects whitespace-only tag names', async () => {
		const item = await createPost(deps, {
			title: 'Tags', slug: 'tags', contentMarkdown: 'Body', tags: [' engineering ', 'engineering']
		});
		expect(item.tags).toEqual(['engineering']);
		await expect(createPost(deps, {
			title: 'Bad tags', slug: 'bad-tags', contentMarkdown: 'Body', tags: [' ']
		})).rejects.toBeInstanceOf(PostError);
	});
});

describe('importDirectory', () => {
	it('imports Windows CRLF sources and resolves forward wikilinks', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'blog-crlf-'));
		writeFileSync(join(dir, 'a.md'),
			'+++\r\ntitle = "A"\r\nslug = "a"\r\nstatus = "published"\r\n+++\r\n\r\nSee [[b]].\r\n');
		writeFileSync(join(dir, 'b.md'), '+++\ntitle = "B"\nslug = "b"\nstatus = "published"\n+++\n\nBody.\n');
		const result = await importDirectory(dir, deps);
		expect(result.errors).toEqual([]);
		expect(result.created).toEqual(['a', 'b']);
		expect((await repos.posts.findBySlug('a'))?.contentHtml).toContain('class="wikilink"');
		expect((await repos.posts.findBySlug('a'))?.contentHtml).not.toContain('broken');
	});

	it('creates, updates and reports per-file errors', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'blog-import-'));
		writeFileSync(
			join(dir, 'a.md'),
			'+++\ntitle = "A"\nslug = "a"\nstatus = "published"\n+++\n\nBody A with [[b]].\n'
		);
		writeFileSync(join(dir, 'broken.md'), '+++\ntitle = = broken\n+++\n\nBody.\n');
		const first = await importDirectory(dir, deps);
		expect(first.created).toEqual(['a']);
		expect(first.errors.map((entry) => entry.file)).toEqual(['broken.md']);
		writeFileSync(
			join(dir, 'a.md'),
			'+++\ntitle = "A2"\nslug = "a"\nstatus = "published"\n+++\n\nBody A2.\n'
		);
		const second = await importDirectory(dir, deps);
		expect(second.updated).toEqual(['a']);
		expect((await getPublishedPost(deps, 'a'))?.title).toBe('A2');
	});
});
