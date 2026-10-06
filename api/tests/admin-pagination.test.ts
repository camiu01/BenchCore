/**
 * @file admin-pagination.test.ts
 * @brief Protected full-ledger search, stable pagination and bounded API inputs.
 */
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createSessionToken, buildSessionExpiry } from '../src/auth/session.js';
import { createHandler, startServer } from '../src/server.js';
import { createPost } from '../src/posts/post-service.js';
import { adminSearchPattern } from '../src/db/admin-page.js';
import { createTestDeps, createTestRepos } from './helpers.js';

const repos = createTestRepos();
const pageSchema = z.object({
	items: z.array(z.object({ id: z.uuid(), title: z.string(), status: z.string() })),
	total: z.number(), counts: z.object({ all: z.number(), draft: z.number(), published: z.number(), archived: z.number() })
});
let server: Server;
let base: string;
let cookie: string;

/** @brief Issues a disposable authenticated test cookie. @param userId User. @return Session cookie. */
async function testCookie(userId: string): Promise<string> {
	const session = createSessionToken();
	await repos.sessions.create({ id: randomUUID(), userId, tokenHash: session.tokenHash, expiresAt: buildSessionExpiry() });
	return `session=${session.token}`;
}

beforeAll(async () => {
	const user = await repos.users.create({ id: randomUUID(), email: 'admin@example.test',
		name: 'Admin', role: 'admin', passwordHash: 'unused' });
	cookie = await testCookie(user.id);
	for (let index = 0; index < 55; index++) {
		await createPost(repos, { title: `Entry ${index}`, slug: `entry-${index}`,
			status: index % 2 ? 'published' : 'draft', contentMarkdown: 'Private body.' });
	}
	await createPost(repos, { title: 'Literal %_ marker', slug: 'special', status: 'archived', contentMarkdown: 'Body.' });
	server = startServer(0, createHandler(createTestDeps(repos)), '127.0.0.1');
	await new Promise<void>((resolve) => server.once('listening', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Missing test listener');
	base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
	if (!server) return;
	await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe('administrator pagination', () => {
	it('makes every post reachable without duplicates', async () => {
		const ids: string[] = [];
		for (const offset of [0, 25, 50]) {
			const response = await fetch(`${base}/api/admin/posts?offset=${offset}`, { headers: { cookie } });
			expect(response.status).toBe(200);
			const page = pageSchema.parse(await response.json());
			expect(page.total).toBe(56);
			expect(page.items).toHaveLength(offset === 50 ? 6 : 25);
			ids.push(...page.items.map((row) => row.id));
		}
		expect(new Set(ids).size).toBe(56);
	});

	it('searches beyond page one and counts statuses before applying the selected status', async () => {
		const response = await fetch(`${base}/api/admin/posts?search=entry-54&status=draft`, { headers: { cookie } });
		const page = pageSchema.parse(await response.json());
		expect(page.items[0]?.title).toBe('Entry 54');
		expect(page.total).toBe(1);
		expect(page.counts).toEqual({ all: 1, draft: 1, published: 0, archived: 0 });
		const filtered = await repos.posts.listAdmin({ limit: 2, offset: 0, search: 'ENTRY', status: 'published' });
		expect(filtered.total).toBe(27);
		expect(filtered.counts).toEqual({ all: 55, draft: 28, published: 27, archived: 0 });
	});

	it('treats SQL wildcard characters as literal text', async () => {
		expect(adminSearchPattern('%_\\')).toBe('%\\%\\_\\\\%');
		expect((await repos.posts.listAdmin({ limit: 25, offset: 0, search: '%_' })).total).toBe(1);
	});

	it.each(['limit=101', 'limit=0', 'offset=-1', 'offset=1000001', 'offset=1.5', 'status=unknown', `search=${'x'.repeat(201)}`])(
		'rejects invalid query %s', async (query) => {
			expect((await fetch(`${base}/api/admin/posts?${query}`, { headers: { cookie } })).status).toBe(400);
		}
	);

	it('requires authorization before returning counts or validating filters', async () => {
		expect((await fetch(`${base}/api/admin/posts?limit=10000`)).status).toBe(401);
		const reader = await repos.users.create({ id: randomUUID(), email: 'reader@example.test',
			name: 'Reader', role: 'reader', passwordHash: 'unused' });
		expect((await fetch(`${base}/api/admin/posts`, {
			headers: { cookie: await testCookie(reader.id) }
		})).status).toBe(403);
	});

	it('protects image metadata and does not expose storage internals or bytes', async () => {
		const record = await repos.media.save(Buffer.from('test-image'), 'Test.png', 'image/png');
		expect(await repos.media.describe?.(record.key)).toEqual(record);
		const path = `${base}/api/admin/media/${record.key}?details=1`;
		expect((await fetch(path)).status).toBe(401);
		const response = await fetch(path, { headers: { cookie } });
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(await response.json()).toEqual(record);
		expect((await fetch(path.replace('details=1', 'details=bad'), { headers: { cookie } })).status).toBe(400);
		expect((await fetch(`${base}/api/admin/media/${'b'.repeat(32)}.png?details=1`, { headers: { cookie } })).status).toBe(404);
	});
});
