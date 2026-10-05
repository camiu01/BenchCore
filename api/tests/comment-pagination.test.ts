/**
 * @file comment-pagination.test.ts
 * @brief Comment pagination reachability, filtering and offset validation regressions.
 */
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { z } from 'zod';
import { hashPassword } from '../src/auth/password.js';
import { createHandler, startServer } from '../src/server.js';
import { createPost } from '../src/posts/post-service.js';
import { createTestDeps, createTestRepos } from './helpers.js';

const repos = createTestRepos();
const pageSchema = z.object({ items: z.array(z.object({ id: z.uuid() })), hasMore: z.boolean() });
let server: Server;
let base: string;
let cookie: string;
let postId: string;

beforeAll(async () => {
	await repos.users.create({
		id: randomUUID(), email: 'moderator@example.com', name: 'Moderator',
		role: 'admin', passwordHash: await hashPassword('test-password')
	});
	await createPost(repos, {
		title: 'Pagination', slug: 'pagination', status: 'published',
		publishedAt: '2020-01-01T00:00:00Z', contentMarkdown: 'Body.'
	});
	postId = (await repos.posts.findBySlug('pagination'))!.id;
	for (let index = 0; index < 205; index += 1) {
		const row = await repos.comments.create({
			id: randomUUID(), postId, authorName: 'Reader', content: `Comment ${index}`
		});
		// Equal timestamps exercise the UUID tie-breaker across page boundaries.
		row.createdAt = new Date('2020-01-01T00:00:00Z');
		await repos.comments.setStatus(row.id, 'approved');
	}
	await repos.comments.create({ id: randomUUID(), postId, authorName: 'Pending', content: 'Not public.' });
	server = startServer(0, createHandler(createTestDeps(repos)));
	await new Promise<void>((resolve) => server.once('listening', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') { throw new Error('Missing test listener'); }
	base = `http://127.0.0.1:${address.port}`;
	const login = await fetch(`${base}/api/auth/login`, {
		method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
		body: JSON.stringify({ email: 'moderator@example.com', password: 'test-password' })
	});
	expect(login.status).toBe(200);
	cookie = login.headers.getSetCookie().map((entry) => entry.split(';')[0]).join('; ');
});

afterAll(async () => {
	await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

it.each(['/api/posts/pagination/comments', '/api/admin/comments?status=approved'])(
	'makes every approved comment reachable through %s', async (path) => {
		const ids: string[] = [];
		for (const offset of [0, 100, 200]) {
			const separator = path.includes('?') ? '&' : '?';
			const response = await fetch(`${base}${path}${separator}offset=${offset}`, { headers: { cookie } });
			expect(response.status).toBe(200);
			const page = pageSchema.parse(await response.json());
			expect(page.items).toHaveLength(offset === 200 ? 5 : 100);
			expect(page.hasMore).toBe(offset < 200);
			ids.push(...page.items.map((item: { id: string }) => item.id));
		}
		expect(new Set(ids).size).toBe(205);
		const expected = path.startsWith('/api/admin')
			? await repos.comments.listByStatus('approved')
			: await repos.comments.listApproved(postId);
		expect(ids.slice(0, 100)).toEqual(expected.slice(0, 100).map((row) => row.id));
	}
);

it.each(['-1', '1.5', 'bad', '', '2147483648', 'Infinity', '1e2'])(
	'rejects invalid offset %s on public and moderation lists', async (offset) => {
		for (const path of ['/api/posts/pagination/comments', '/api/admin/comments']) {
			const response = await fetch(`${base}${path}?offset=${encodeURIComponent(offset)}`, { headers: { cookie } });
			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ error: 'validation' });
		}
	}
);

it('defaults to zero, filters pending comments and handles exhausted offsets', async () => {
	const first = await fetch(`${base}/api/posts/pagination/comments`);
	expect(pageSchema.parse(await first.json()).hasMore).toBe(true);
	const pending = await fetch(`${base}/api/admin/comments?status=pending`, { headers: { cookie } });
	const page = pageSchema.parse(await pending.json());
	expect(page.items).toHaveLength(1);
	expect(page.hasMore).toBe(false);
	const empty = await fetch(`${base}/api/posts/pagination/comments?offset=300`);
	expect(await empty.json()).toEqual({ items: [], hasMore: false });
	expect(await repos.comments.listApproved(postId, 200)).toHaveLength(5);
	expect(await repos.comments.listByStatus('approved', 200)).toHaveLength(5);
});
