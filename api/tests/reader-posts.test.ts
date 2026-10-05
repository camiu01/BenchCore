/**
 * @file reader-posts.test.ts
 * @brief Reader-only publication access, search privacy, media and cache regressions.
 */
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createSessionToken } from '../src/auth/session.js';
import { createHandler, startServer } from '../src/server.js';
import { createPost } from '../src/posts/post-service.js';
import { createTestDeps, createTestRepos } from './helpers.js';

const repos = createTestRepos();
const cookies = new Map<string, string>();
let server: Server;
let base = '';
let postId = '';
let mediaKey = '';
const secret = 'sensitivebodyword';
const description = 'sensitivedescriptionword';
const detail = z.object({ locked: z.boolean(), description: z.string(), contentHtml: z.string() });
const listPage = z.object({
	total: z.number(),
	items: z.array(z.object({ slug: z.string(), locked: z.boolean(), description: z.string() }))
});
const graphDto = z.object({
	nodes: z.array(z.object({ slug: z.string(), description: z.string() })),
	edges: z.array(z.unknown())
});

beforeAll(async () => {
	for (const role of ['reader', 'admin', 'expired']) {
		const id = randomUUID();
		await repos.users.create({
			id, email: `${role}@example.test`, name: role,
			role: role === 'admin' ? 'admin' : 'reader', passwordHash: 'unused-test-hash'
		});
		const token = createSessionToken();
		await repos.sessions.create({ id: randomUUID(), userId: id, tokenHash: token.tokenHash,
			expiresAt: new Date(role === 'expired' ? 0 : Date.now() + 60_000) });
		cookies.set(role, `session=${token.token}`);
	}
	const media = await repos.media.save(Buffer.from('image'), 'protected.png', 'image/png');
	mediaKey = media.key;
	const post = await createPost(repos, {
		title: 'Visible title', slug: 'reader-record', status: 'published', audience: 'readers',
		description, publishedAt: '2020-01-01T00:00:00Z', coverImage: `/api/media/${mediaKey}`,
		contentMarkdown: `${secret} ![protected](/api/media/${mediaKey}) [[public-target]]`, tags: ['members']
	});
	postId = post.id;
	await createPost(repos, { title: 'Public target', slug: 'public-target', status: 'published',
		publishedAt: '2020-01-01T00:00:00Z', contentMarkdown: 'Public body.' });
	server = startServer(0, createHandler(createTestDeps(repos)), '127.0.0.1');
	await new Promise<void>((resolve) => server.once('listening', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Missing test port');
	base = `http://127.0.0.1:${address.port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

/**
 * @brief Sends a scoped test request, optionally authenticated and mutating.
 * @param path Fixed API path.
 * @param role Fixture session role.
 * @param method HTTP method.
 * @param body Optional JSON payload.
 * @return Response.
 */
function request(path: string, role = '', method = 'GET', body?: unknown) {
	return fetch(base + path, { method, headers: {
		cookie: cookies.get(role) ?? '', origin: 'http://localhost:5173', 'content-type': 'application/json'
	}, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

describe('reader-only posts', () => {
	it.each(['', 'expired'])('returns only metadata to anonymous or expired session %s', async (role) => {
		const response = await request('/api/posts/reader-record', role);
		const dto = await response.json();
		expect(dto).toMatchObject({ title: 'Visible title', audience: 'readers', locked: true,
			description: '', contentHtml: '', coverImage: null, backlinks: [], readingMinutes: 0 });
		expect(JSON.stringify(dto)).not.toContain(secret);
		expect(JSON.stringify(dto)).not.toContain(mediaKey);
		expect(response.headers.get('cache-control')).toContain('no-store');
		expect(response.headers.get('vary')).toContain('Cookie');
	});

	it.each(['reader', 'admin'])('allows the full published record for %s', async (role) => {
		const response = await request('/api/posts/reader-record', role);
		const dto = detail.parse(await response.json());
		expect(dto.locked).toBe(false);
		expect(dto.description).toBe(description);
		expect(dto.contentHtml).toContain(secret);
		expect((await request(`/api/media/${mediaKey}`, role)).status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('private, no-store');
	});

	it('redacts lists and graph descriptions and hides private wikilinks', async () => {
		const list = listPage.parse(await (await request('/api/posts')).json());
		expect(list.items.find((item: { slug: string }) => item.slug === 'reader-record'))
			.toMatchObject({ locked: true, description: '' });
		const graph = graphDto.parse(await (await request('/api/graph')).json());
		expect(graph.nodes.find((item: { slug: string }) => item.slug === 'reader-record')?.description).toBe('');
		expect(graph.edges).toEqual([]);
		expect(JSON.stringify(graph)).not.toContain(description);
	});

	it('prevents private-body and description search oracles while allowing title search', async () => {
		for (const term of [secret, description]) {
			const path = `/api/posts?search=${term}`;
			expect(listPage.parse(await (await request(path)).json()).total).toBe(0);
			expect(listPage.parse(await (await request(path, 'reader')).json()).total).toBe(1);
		}
		expect(listPage.parse(await (await request('/api/posts?search=Visible')).json()).total).toBe(1);
		expect(listPage.parse(await (await request(`/api/posts?search=${secret}&viewerRole=admin&includeReaderContent=true`)).json()).total).toBe(0);
	});

	it('blocks anonymous media and engagement reads and mutations', async () => {
		expect((await request(`/api/media/${mediaKey}`)).status).toBe(404);
		for (const resource of ['comments', 'likes']) {
			expect((await request(`/api/posts/reader-record/${resource}`)).status).toBe(401);
			expect((await request(`/api/posts/reader-record/${resource}`, '', 'POST', {
				authorName: 'Guest', content: 'Unauthorized comment'
			})).status).toBe(401);
			expect((await request(`/api/posts/reader-record/${resource}`, 'reader')).status).toBe(200);
		}
	});

	it('keeps creation, editing and deletion administrator-only', async () => {
		for (const method of ['PUT', 'DELETE']) {
			expect((await request(`/api/posts/${postId}`, 'reader', method, { audience: 'public' })).status).toBe(403);
		}
		expect((await request('/api/posts', 'reader', 'POST', {
			title: 'Blocked', slug: 'blocked', contentMarkdown: 'Body.', audience: 'readers'
		})).status).toBe(403);
		expect((await request(`/api/posts/${postId}`, 'admin', 'PUT', { audience: 'invalid' })).status).toBe(400);
	});

	it('does not expose draft-only reader posts to readers', async () => {
		await createPost(repos, {
			title: 'Private draft', slug: 'reader-draft', audience: 'readers', contentMarkdown: secret
		});
		expect((await request('/api/posts/reader-draft', 'reader')).status).toBe(404);
	});

	it('preserves the private audience when an administrator patches unrelated fields', async () => {
		expect((await request(`/api/posts/${postId}`, 'admin', 'PUT', { title: 'Visible title' })).status).toBe(200);
		expect((await repos.posts.findById(postId))?.audience).toBe('readers');
		expect(detail.parse(await (await request('/api/posts/reader-record')).json()).locked).toBe(true);
	});

	it('keeps explicitly shared public images public without exposing the protected body', async () => {
		await createPost(repos, {
			title: 'Shared public image', slug: 'shared-public-image', status: 'published',
			contentMarkdown: `![public](/api/media/${mediaKey})`
		});
		expect((await request(`/api/media/${mediaKey}`)).status).toBe(200);
		expect(detail.parse(await (await request('/api/posts/reader-record')).json()).contentHtml).toBe('');
	});
});
