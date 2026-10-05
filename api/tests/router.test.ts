/**
 * @file router.test.ts
 * @brief End-to-end router tests: auth flow, post CRUD and media upload.
 */
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../src/auth/password.js';
import { createHandler, startServer, type ApiDeps } from '../src/server.js';
import { createTestDeps, createTestRepos, type TestRepos } from './helpers.js';

let server: Server;
let baseUrl: string;
let deps: ApiDeps;
let repos: TestRepos;

beforeAll(async () => {
	repos = createTestRepos();
	deps = createTestDeps(repos);
	await repos.users.create({
		id: randomUUID(),
		email: 'admin@example.com',
		passwordHash: await hashPassword('secret'),
		name: 'Admin',
		role: 'admin'
	});
	server = startServer(0, createHandler(deps));
	await new Promise<void>((resolve) => server.once('listening', resolve));
	const address = server.address() as AddressInfo;
	baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve()))
	);
});

/**
 * @brief Logs in and returns the raw Cookie header value.
 * @return The session cookie for authenticated requests.
 */
async function loginCookie(): Promise<string> {
	const response = await fetch(`${baseUrl}/api/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
		body: JSON.stringify({ email: 'admin@example.com', password: 'secret' })
	});
	expect(response.status).toBe(200);
	const setCookie = response.headers.getSetCookie();
	expect(setCookie.length).toBeGreaterThan(0);
	return setCookie.map((entry) => entry.split(';')[0]).join('; ');
}

/**
 * @brief Sends a JSON request with an optional session cookie.
 * @param path The API path.
 * @param init Fetch options plus optional cookie.
 * @return The fetch response.
 */
function apiFetch(
	path: string,
	init: RequestInit & { cookie?: string } = {}
): Promise<Response> {
	const { cookie, ...rest } = init;
	return fetch(`${baseUrl}${path}`, {
		...rest,
		headers: {
			'content-type': 'application/json',
			origin: 'http://localhost:5173',
			...(cookie !== undefined ? { cookie } : {}),
			...rest.headers
		}
	});
}

describe('auth endpoints', () => {
	it('rejects bad credentials and unknown sessions', async () => {
		const bad = await apiFetch('/api/auth/login', {
			method: 'POST',
			body: JSON.stringify({ email: 'admin@example.com', password: 'nope' })
		});
		expect(bad.status).toBe(401);
		const me = await fetch(`${baseUrl}/api/auth/me`);
		expect(me.status).toBe(401);
	});

	it('logs in, resolves me and logs out', async () => {
		const cookie = await loginCookie();
		const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
		expect(me.status).toBe(200);
		expect(((await me.json()) as { user: { email: string } }).user.email).toBe('admin@example.com');
		const logout = await fetch(`${baseUrl}/api/auth/logout`, {
			method: 'POST',
			headers: { cookie, origin: 'http://localhost:5173' }
		});
		expect(logout.status).toBe(200);
		const after = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
		expect(after.status).toBe(401);
	});
});

describe('post endpoints', () => {
	it('guards mutations behind auth and masks drafts', async () => {
		const denied = await apiFetch('/api/posts', {
			method: 'POST',
			body: JSON.stringify({ title: 'X', slug: 'x', contentMarkdown: 'x' })
		});
		expect(denied.status).toBe(401);
		const cookie = await loginCookie();
		const created = await apiFetch('/api/posts', {
			method: 'POST',
			cookie,
			body: JSON.stringify({ title: 'Draft', slug: 'draft-post', contentMarkdown: 'Body.' })
		});
		expect(created.status).toBe(201);
		const draftId = ((await created.json()) as { id: string }).id;
		expect((await fetch(`${baseUrl}/api/posts/draft-post`)).status).toBe(404);
		const published = await apiFetch(`/api/posts/${draftId}`, {
			method: 'PUT',
			cookie,
			body: JSON.stringify({ status: 'published' })
		});
		expect(published.status).toBe(200);
		const shown = await fetch(`${baseUrl}/api/posts/draft-post`);
		expect(shown.status).toBe(200);
		expect(((await shown.json()) as { title: string }).title).toBe('Draft');
		const listed = await fetch(`${baseUrl}/api/posts?limit=10&offset=0`);
		expect(((await listed.json()) as { total: number }).total).toBe(1);
		const removed = await apiFetch(`/api/posts/${draftId}`, { method: 'DELETE', cookie });
		expect(removed.status).toBe(204);
		expect((await fetch(`${baseUrl}/api/posts/draft-post`)).status).toBe(404);
	});

	it('validates payloads and rejects duplicates', async () => {
		const cookie = await loginCookie();
		const bad = await apiFetch('/api/posts', {
			method: 'POST',
			cookie,
			body: JSON.stringify({ title: '', slug: 'Bad Slug' })
		});
		expect(bad.status).toBe(400);
		await apiFetch('/api/posts', {
			method: 'POST',
			cookie,
			body: JSON.stringify({ title: 'One', slug: 'dupe', contentMarkdown: 'x' })
		});
		const dupe = await apiFetch('/api/posts', {
			method: 'POST',
			cookie,
			body: JSON.stringify({ title: 'Two', slug: 'dupe', contentMarkdown: 'x' })
		});
		expect(dupe.status).toBe(409);
	});

	it('moderates comments and toggles anonymous likes on published posts', async () => {
		const cookie = await loginCookie();
		const created = await apiFetch('/api/posts', {
			method: 'POST',
			cookie,
			body: JSON.stringify({
				title: 'Discussion',
				slug: 'discussion',
				status: 'published',
				contentMarkdown: 'Public body.'
			})
		});
		expect(created.status).toBe(201);
		const comment = await apiFetch('/api/posts/discussion/comments', {
			method: 'POST',
			body: JSON.stringify({ authorName: 'Reader', content: 'Useful record.' })
		});
		expect(comment.status).toBe(202);
		expect(await fetch(`${baseUrl}/api/posts/discussion/comments`).then((response) => response.json()))
			.toEqual({ items: [], hasMore: false });
		const queue = await fetch(`${baseUrl}/api/admin/comments?status=pending`, {
			headers: { cookie }
		});
		const queued = await queue.json() as { items: { id: string }[] };
		expect(queued.items).toHaveLength(1);
		expect((await apiFetch(`/api/admin/comments/${queued.items[0]!.id}`, {
			method: 'PATCH',
			cookie,
			body: JSON.stringify({ status: 'approved' })
		})).status).toBe(200);
		const approved = await fetch(`${baseUrl}/api/posts/discussion/comments`);
		expect((await approved.json() as { items: { content: string }[] }).items[0]?.content)
			.toBe('Useful record.');

		const firstLike = await apiFetch('/api/posts/discussion/likes', { method: 'POST' });
		expect(await firstLike.json()).toMatchObject({ liked: true, count: 1 });
		const voterCookie = firstLike.headers.getSetCookie()[0]!.split(';')[0]!;
		const likedState = await fetch(`${baseUrl}/api/posts/discussion/likes`, {
			headers: { cookie: voterCookie }
		});
		expect(await likedState.json()).toEqual({ liked: true, count: 1 });
		const removedLike = await apiFetch('/api/posts/discussion/likes', {
			method: 'POST',
			cookie: voterCookie
		});
		expect(await removedLike.json()).toMatchObject({ liked: false, count: 0 });
	});
});

describe('media endpoints', () => {
	it('accepts the complete advertised 5 MiB limit without regex stack overflow', async () => {
		const cookie = await loginCookie();
		const uploaded = await apiFetch('/api/media', {
			method: 'POST', cookie,
			body: JSON.stringify({
				filename: 'limit.png', mime: 'image/png', contentBase64: Buffer.alloc(5 * 1024 * 1024).toString('base64')
			})
		});
		expect(uploaded.status).toBe(201);
		const record = await uploaded.json() as { key: string; sizeBytes: number };
		expect(record.sizeBytes).toBe(5 * 1024 * 1024);
		const removed = await apiFetch(`/api/media/${record.key}`, { method: 'DELETE', cookie });
		expect(removed.status).toBe(204);
	});

	it('uploads, serves and deletes images behind auth', async () => {
		const cookie = await loginCookie();
		const png =
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
		const denied = await apiFetch('/api/media', {
			method: 'POST',
			body: JSON.stringify({ filename: 'x.png', mime: 'image/png', contentBase64: png })
		});
		expect(denied.status).toBe(401);
		const uploaded = await apiFetch('/api/media', {
			method: 'POST',
			cookie,
			body: JSON.stringify({ filename: 'dot.png', mime: 'image/png', contentBase64: png })
		});
		expect(uploaded.status).toBe(201);
		const record = (await uploaded.json()) as { key: string; url: string };
		const served = await fetch(`${baseUrl}${record.url}`);
		expect(served.status).toBe(200);
		expect(served.headers.get('content-type')).toBe('image/png');
		const removed = await fetch(`${baseUrl}/api/media/${record.key}`, {
			method: 'DELETE',
			headers: { cookie, origin: 'http://localhost:5173' }
		});
		expect(removed.status).toBe(204);
		expect((await fetch(`${baseUrl}${record.url}`)).status).toBe(404);
	});
});

describe('admin and render endpoints', () => {
	it('guards the lightweight wikilink index and excludes content fields', async () => {
		expect((await fetch(`${baseUrl}/api/admin/posts/suggestions`)).status).toBe(401);
		const cookie = await loginCookie();
		const response = await apiFetch('/api/admin/posts/suggestions', { cookie });
		expect(response.status).toBe(200);
		const result = await response.json() as {
			items: { id: string; slug: string; title: string }[];
		};
		expect(result.items.length).toBeGreaterThan(0);
		expect(result.items.length).toBeLessThanOrEqual(200);
		for (const row of result.items) {
			expect(Object.keys(row).sort()).toEqual(['id', 'slug', 'title']);
		}
	});
	it('serves drafts by id behind auth and renders previews', async () => {
		const anon = await fetch(`${baseUrl}/api/admin/posts`);
		expect(anon.status).toBe(401);
		const cookie = await loginCookie();
		const created = await apiFetch('/api/posts', {
			method: 'POST',
			cookie,
			body: JSON.stringify({ title: 'Hidden', slug: 'hidden', contentMarkdown: 'Body.' })
		});
		const id = ((await created.json()) as { id: string }).id;
		const shown = await fetch(`${baseUrl}/api/admin/posts/${id}`, { headers: { cookie } });
		expect(shown.status).toBe(200);
		expect(((await shown.json()) as { contentMarkdown: string }).contentMarkdown).toBe('Body.');
		const missing = await fetch(`${baseUrl}/api/admin/posts/nope`, { headers: { cookie } });
		expect(missing.status).toBe(404);
		const preview = await apiFetch('/api/render', {
			method: 'POST',
			cookie,
			body: JSON.stringify({ markdown: '# Hi\n\n<script>alert(1)</script>' })
		});
		expect(preview.status).toBe(200);
		const html = ((await preview.json()) as { html: string }).html;
		expect(html).toContain('<h1>Hi</h1>');
		expect(html).not.toContain('<script>');
		const denied = await apiFetch('/api/render', {
			method: 'POST',
			body: JSON.stringify({ markdown: '# Hi' })
		});
		expect(denied.status).toBe(401);
	});

	it('updates and deletes tags through administrator endpoints', async () => {
		const cookie = await loginCookie();
		const [tag] = await repos.tags.upsertByName(['graph']);
		const updated = await apiFetch(`/api/admin/tags/${tag!.id}`, {
			method: 'PATCH',
			cookie,
			body: JSON.stringify({ color: '#2563eb' })
		});
		expect(updated.status).toBe(200);
		expect(await updated.json()).toMatchObject({ color: '#2563EB' });
		expect((await apiFetch(`/api/admin/tags/${tag!.id}`, {
			method: 'PATCH',
			cookie,
			body: JSON.stringify({ color: 'red' })
		})).status).toBe(400);
		expect((await apiFetch(`/api/admin/tags/${tag!.id}`, { method: 'DELETE' })).status).toBe(401);
		expect((await apiFetch(`/api/admin/tags/${tag!.id}`, { method: 'DELETE', cookie })).status).toBe(204);
		expect((await repos.tags.list()).find((item) => item.id === tag!.id)).toBeUndefined();
	});
});
