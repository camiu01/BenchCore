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
});

describe('importDirectory', () => {
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
