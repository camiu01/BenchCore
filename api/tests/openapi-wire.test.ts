/**
 * @file openapi-wire.test.ts
 * @brief Sample real HTTP responses agree with the models used to generate OpenAPI.
 */
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createHandler } from '../src/server.js';
import { nodeHandlerFetch } from '../src/http/web.js';
import { hashPassword } from '../src/auth/password.js';
import { createTestDeps, createTestRepos } from './helpers.js';
import { adminPost, items, post, postLink, user } from '../scripts/openapi/schemas.js';

const origin = 'http://localhost:5173';
let repos: ReturnType<typeof createTestRepos>;
let handler: ReturnType<typeof createHandler>;
beforeEach(() => {
	repos = createTestRepos();
	handler = createHandler(createTestDeps(repos));
});

/** @brief Executes actual handlers without opening a socket. @param path API path. @param method HTTP verb. @param data JSON payload. @param cookie Session fixture. @return HTTP response. */
function request(path: string, method = 'GET', data?: unknown, cookie?: string): Promise<Response> {
	return nodeHandlerFetch(
		handler,
		new Request(origin + path, {
			method,
			headers: {
				origin,
				'content-type': 'application/json',
				...(cookie ? { cookie } : {})
			},
			...(data === undefined ? {} : { body: JSON.stringify(data) })
		}),
		'contract-fixture'
	);
}

/** @brief Creates an isolated administrator and checks the documented login DTO. @return Session cookie fixture. */
async function login(): Promise<string> {
	await repos.users.create({
		id: randomUUID(),
		username: 'contract-admin',
		email: 'contract@example.test',
		name: 'Contract operator',
		role: 'admin',
		passwordHash: await hashPassword('contract-fixture-password')
	});
	const response = await request('/api/auth/login', 'POST', {
		username: 'contract-admin',
		password: 'contract-fixture-password'
	});
	expect(response.status).toBe(200);
	expect(z.object({ user }).safeParse(await response.json()).success).toBe(true);
	const cookie = response.headers.getSetCookie()[0]?.split(';')[0];
	if (!cookie) throw new Error('Expected a login session cookie');
	return cookie;
}

describe('OpenAPI response model samples', () => {
	it('matches create, public detail, editable detail and list DTOs', async () => {
		const cookie = await login();
		const created = await request(
			'/api/posts',
			'POST',
			{
				title: 'Contract note',
				slug: 'contract-note',
				status: 'published',
				contentMarkdown: 'Public content.'
			},
			cookie
		);
		expect(created.status).toBe(201);
		const row = post.parse(await created.json());
		const detail = post.extend({
			contentHtml: z.string(),
			coverImage: z.string().nullable(),
			readingMinutes: z.number(),
			backlinks: z.array(postLink)
		});
		expect(detail.safeParse(await (await request('/api/posts/contract-note')).json()).success).toBe(
			true
		);
		expect(items(post, true).safeParse(await (await request('/api/posts')).json()).success).toBe(
			true
		);
		const editable = await request(`/api/admin/posts/${row.id}`, 'GET', undefined, cookie);
		expect(
			adminPost
				.extend({
					contentMarkdown: z.string(),
					contentHtml: z.string(),
					coverImage: z.string().nullable()
				})
				.safeParse(await editable.json()).success
		).toBe(true);
	});

	it('keeps locked responses redacted and unpublished slugs indistinguishable from missing', async () => {
		const cookie = await login();
		await request(
			'/api/posts',
			'POST',
			{
				title: 'Locked note',
				slug: 'locked-note',
				status: 'published',
				audience: 'readers',
				description: 'Protected summary',
				contentMarkdown: 'Protected content.'
			},
			cookie
		);
		const locked = await request('/api/posts/locked-note');
		const payload = post.passthrough().parse(await locked.json());
		expect(payload.locked).toBe(true);
		expect(payload.description).toBe('');
		expect(payload['contentHtml']).toBe('');
		expect(locked.headers.get('cache-control')).toContain('no-store');
		await request(
			'/api/posts',
			'POST',
			{
				title: 'Draft',
				slug: 'draft-note',
				contentMarkdown: 'Not public.'
			},
			cookie
		);
		for (const slug of ['draft-note', 'missing-note']) {
			const response = await request(`/api/posts/${slug}`);
			expect(response.status).toBe(404);
			expect(await response.json()).toEqual({ error: 'not_found' });
		}
	});

	it('rejects missing Origin and returns an empty 204 for UUID deletion', async () => {
		const cookie = await login();
		const missingOrigin = await nodeHandlerFetch(
			handler,
			new Request(origin + '/api/auth/logout', {
				method: 'POST',
				headers: { cookie }
			}),
			'contract-fixture'
		);
		expect(missingOrigin.status).toBe(403);
		const created = await request(
			'/api/posts',
			'POST',
			{
				title: 'Disposable note',
				slug: 'disposable-note',
				contentMarkdown: 'Delete only this fixture.'
			},
			cookie
		);
		const row = post.parse(await created.json());
		const removed = await request(`/api/posts/${row.id}`, 'DELETE', undefined, cookie);
		expect(removed.status).toBe(204);
		expect(await removed.text()).toBe('');
	});
});
