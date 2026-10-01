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
		headers: { 'content-type': 'application/json' },
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
			headers: { cookie }
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
});

describe('media endpoints', () => {
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
			headers: { cookie }
		});
		expect(removed.status).toBe(204);
		expect((await fetch(`${baseUrl}${record.url}`)).status).toBe(404);
	});
});

describe('admin and render endpoints', () => {
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
});
