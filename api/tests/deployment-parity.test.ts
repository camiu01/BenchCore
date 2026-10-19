/**
 * @file deployment-parity.test.ts
 * @brief Identical account and publishing journeys over TCP and Vercel's Fetch adapter.
 */
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createHandler } from '../src/server.js';
import { createVercelHandler } from '../src/serverless/handler.js';
import { nodeHandlerFetch } from '../src/http/web.js';
import { hashPassword } from '../src/auth/password.js';
import { createTestDeps, createTestRepos } from './helpers.js';

describe.each(['node', 'serverless'] as const)('%s deployment contract', (target) => {
	it('preserves sessions, private content, publishing and global revocation', async () => {
		const repos = createTestRepos();
		const password = 'fixture-parity-password-only';
		await repos.users.create({ id: randomUUID(), username: 'operator', name: 'Operator',
			email: 'operator@example.test', role: 'admin', passwordHash: await hashPassword(password) });
		const api = createHandler(createTestDeps(repos));
		const server = createServer(api);
		server.listen(0, '127.0.0.1');
		await once(server, 'listening');
		const address = server.address();
		if (!address || typeof address === 'string') { throw new Error('No fixture port'); }
		const base = `http://127.0.0.1:${address.port}`;
		const handler = createVercelHandler({}, () => ({ handler: api,
			ready: async () => {}, fetch: (req, peer) => nodeHandlerFetch(api, req, peer) }));
		/**
		 * @brief Sends the same HTTP contract through the chosen deployment transport.
		 * @param path API path. @param method HTTP method. @param body JSON data.
		 * @param cookie Optional fixture session. @return Response.
		 */
		const request = (path: string, method = 'GET', body?: unknown, cookie?: string) => {
			const req = new Request(base + path, { method,
				headers: { origin: 'http://localhost:5173', 'content-type': 'application/json',
					...(cookie ? { cookie } : {}) },
				...(body === undefined ? {} : { body: JSON.stringify(body) }) });
			return target === 'node' ? fetch(req) : nodeHandlerFetch(handler, req, '127.0.0.1');
		};
		try {
			await journey(request, password);
		} finally {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	});
});

/**
 * @brief Checks the shared public and administrator journey across transports.
 * @param request Fixture dispatcher. @param password Synthetic administrator password.
 * @return Completed assertions.
 */
async function journey(request: (path: string, method?: string, body?: unknown, cookie?: string) => Promise<Response>,
	password: string): Promise<void> {
	expect((await request('/api/admin/posts')).status).toBe(401);
	const login = await request('/api/auth/login', 'POST', { username: 'operator', password });
	expect(login.status).toBe(200);
	const cookie = login.headers.getSetCookie()[0]?.split(';')[0];
	expect(cookie).toBeTruthy();
	const draft = await request('/api/posts', 'POST', {
		title: 'Parity draft', slug: 'parity-draft', status: 'draft',
		contentMarkdown: 'Private draft body', tags: ['parity']
	}, cookie);
	expect(draft.status).toBe(201);
	expect((await request('/api/posts/parity-draft')).status).toBe(404);
	const { id } = z.object({ id: z.uuid() }).parse(await draft.json());
	const published = await request(`/api/posts/${id}`, 'PUT', {
		title: 'Parity draft', slug: 'parity-draft', status: 'published',
		audience: 'readers', contentMarkdown: 'Private draft body', tags: ['parity']
	}, cookie);
	expect(published.status).toBe(200);
	const guest = await request('/api/posts/parity-draft');
	expect(guest.headers.get('cache-control')).toContain('no-store');
	const locked = z.object({ locked: z.boolean() }).passthrough().parse(await guest.json());
	expect(locked.locked).toBe(true);
	expect(JSON.stringify(locked)).not.toContain('Private draft body');
	expect((await request('/api/posts/parity-draft', 'GET', undefined, cookie)).status).toBe(200);
	expect((await request('/api/auth/logout/all', 'POST', {}, cookie)).status).toBe(200);
	expect((await request('/api/auth/me', 'GET', undefined, cookie)).status).toBe(401);
}
