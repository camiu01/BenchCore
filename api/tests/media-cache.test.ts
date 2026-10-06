/**
 * @file media-cache.test.ts
 * @brief Conditional media reads recheck current audience before returning bytes or 304.
 */
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHandler, startServer } from '../src/server.js';
import { createPost } from '../src/posts/post-service.js';
import { createTestDeps, createTestRepos } from './helpers.js';

const repos = createTestRepos();
let server: Server;
let base = '';
beforeAll(async () => {
	server = startServer(0, createHandler(createTestDeps(repos)), '127.0.0.1');
	await new Promise<void>((resolve) => server.once('listening', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Missing test listener');
	base = `http://127.0.0.1:${address.port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('audience-aware media revalidation', () => {
	it('returns a private 304 for public bytes but denies the same conditional request after a visibility change', async () => {
		const media = await repos.media.save(Buffer.from('image'), 'image.png', 'image/png');
		const post = await createPost(repos, { title: 'Public', slug: 'public-image', status: 'published',
			contentMarkdown: `![](/api/media/${media.key})` });
		const url = `${base}/api/media/${media.key}`;
		const initial = await fetch(url);
		const etag = initial.headers.get('etag');
		expect(etag).toMatch(/^"sha256-[a-f0-9]{64}"$/);
		expect(initial.headers.get('cache-control')).toBe('private, no-cache, must-revalidate');
		expect(initial.headers.get('vercel-cdn-cache-control')).toBe('no-store');
		await initial.arrayBuffer();
		expect((await fetch(url, { headers: { 'if-none-match': etag ?? '' } })).status).toBe(304);
		await repos.posts.update(post.id, { audience: 'readers' });
		const denied = await fetch(url, { headers: { 'if-none-match': etag ?? '' } });
		expect(denied.status).toBe(404);
		expect(denied.headers.get('etag')).toBeNull();
		expect(denied.headers.get('cache-control')).toContain('no-store');
	});
});
