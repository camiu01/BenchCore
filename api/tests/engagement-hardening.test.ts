/**
 * @file engagement-hardening.test.ts
 * @brief Independent submission quotas, honeypot filtering and unchanged approval/privacy boundaries.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHandler } from '../src/server.js';
import { nodeHandlerFetch } from '../src/http/web.js';
import { createPost } from '../src/posts/post-service.js';
import { createSessionToken } from '../src/auth/session.js';
import { createTestDeps, createTestRepos } from './helpers.js';

const origin = 'http://localhost:5173';
const fields = { authorName: 'Reader', content: 'A useful observation.' };
let repos: ReturnType<typeof createTestRepos>;
let handler: ReturnType<typeof createHandler>;
beforeEach(async () => {
	repos = createTestRepos();
	await createPost(repos, { title: 'Comment test', slug: 'comment-test', contentMarkdown: 'Body.',
		status: 'published', publishedAt: '2020-01-01T00:00:00Z' });
	handler = createHandler({ ...createTestDeps(repos), rateLimit: { windowMs: 60_000, requests: 1000,
		loginRequests: 1000, commentRequests: 2 } });
});
afterEach(() => { vi.restoreAllMocks(); });

/** @brief Submits a synthetic comment with a selected peer. @param data Fields. @param address Peer. @param cookie Optional session. @return Response. */
function submit(data: unknown = fields, address = '203.0.113.1', cookie?: string) {
	return nodeHandlerFetch(handler, new Request(`${origin}/api/posts/comment-test/comments`, {
		method: 'POST', headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
		body: JSON.stringify(data)
	}), address);
}

describe('comment anti-spam and quotas', () => {
	it('silently discards honeypot submissions and keeps every real submission pending', async () => {
		expect((await submit({ ...fields, website: 'https://spam.invalid' })).status).toBe(202);
		expect(await repos.comments.listByStatus()).toHaveLength(0);
		expect((await submit({ ...fields, website: '' })).status).toBe(202);
		expect(await repos.comments.listByStatus('pending')).toHaveLength(1);
		const post = (await repos.posts.findBySlug('comment-test'))!;
		expect(await repos.comments.listApproved(post.id)).toEqual([]);
	});
	it('limits IPs across anonymous and changing-session requests without limiting reads', async () => {
		expect((await submit()).status).toBe(202);
		expect((await submit(fields, '203.0.113.1', `session=${createSessionToken().token}`)).status).toBe(202);
		const denied = await submit(fields, '203.0.113.1', `session=${createSessionToken().token}`);
		expect(denied.status).toBe(429);
		expect(denied.headers.get('retry-after')).toBe('60');
		const read = await nodeHandlerFetch(handler, new Request(`${origin}/api/posts/comment-test/comments`), '203.0.113.1');
		expect(read.status).toBe(200);
		expect((await submit(fields, '203.0.113.2')).status).toBe(202);
	});
	it('limits one session independently when its peer address changes', async () => {
		const cookie = `session=${createSessionToken().token}`;
		expect((await submit(fields, '203.0.113.1', cookie)).status).toBe(202);
		expect((await submit(fields, '203.0.113.2', cookie)).status).toBe(202);
		expect((await submit(fields, '203.0.113.3', cookie)).status).toBe(429);
		expect((await submit(fields, '203.0.113.3')).status).toBe(202);
	});
	it('resets quotas at the fixed window and bounds new client state', async () => {
		const now = Date.now();
		const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
		expect((await submit()).status).toBe(202);
		expect((await submit()).status).toBe(202);
		clock.mockReturnValue(now + 60_001);
		expect((await submit()).status).toBe(202);
		handler = createHandler({ ...createTestDeps(repos), rateLimit: {
			windowMs: 60_000, requests: 1000, loginRequests: 1000, commentRequests: 2, maxClients: 1
		} });
		expect((await submit(fields, '203.0.113.1')).status).toBe(202);
		expect((await submit(fields, '203.0.113.2')).status).toBe(429);
	});
	it('masks unpublished posts and does not let the honeypot bypass validation or CSRF', async () => {
		const bad = await submit({ ...fields, website: 'x'.repeat(201) });
		expect(bad.status).toBe(400);
		const hostile = new Request(`${origin}/api/posts/comment-test/comments`, {
			method: 'POST', body: JSON.stringify(fields), headers: { origin: 'https://hostile.invalid' }
		});
		expect((await nodeHandlerFetch(handler, hostile, '203.0.113.4')).status).toBe(403);
		const post = (await repos.posts.findBySlug('comment-test'))!;
		await repos.posts.update(post.id, { status: 'draft' });
		expect((await submit(fields, '203.0.113.5')).status).toBe(404);
		expect(await repos.comments.listByStatus()).toHaveLength(0);
	});
});
