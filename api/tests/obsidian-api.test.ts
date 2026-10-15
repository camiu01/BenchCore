/**
 * @file obsidian-api.test.ts
 * @brief Import endpoint authentication, trusted origins and private note isolation.
 */
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSessionToken, buildSessionExpiry } from '../src/auth/session.js';
import { createHandler, startServer } from '../src/server.js';
import { createTestDeps, createTestRepos } from './helpers.js';

const repos = createTestRepos();
let server: Server;
let base: string;
let adminCookie: string;
let readerCookie: string;
const origin = 'http://localhost:5173';
const body = JSON.stringify({ visibility: 'private', files: [{ path: 'Secret.md', source: 'Private payload' }] });

/** @brief Creates an isolated test session. @param role User role. @return Session cookie. */
async function cookieFor(role: 'admin' | 'reader'): Promise<string> {
	const user = await repos.users.create({ id: randomUUID(), email: `${role}@example.test`,
		name: role, role, passwordHash: 'unused' });
	const session = createSessionToken();
	await repos.sessions.create({ id: randomUUID(), userId: user.id,
		tokenHash: session.tokenHash, expiresAt: buildSessionExpiry() });
	return `session=${session.token}`;
}

beforeAll(async () => {
	adminCookie = await cookieFor('admin');
	readerCookie = await cookieFor('reader');
	server = startServer(0, createHandler(createTestDeps(repos)), '127.0.0.1');
	await new Promise<void>((resolve) => server.once('listening', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') { throw new Error('missing listener'); }
	base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
	if (server) { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

describe('Obsidian API boundary', () => {
	it('rejects visitors, readers and untrusted origins', async () => {
		for (const [cookie, expected] of [['', 401], [readerCookie, 403]] as const) {
			const response = await fetch(`${base}/api/admin/imports/obsidian`, {
				method: 'POST', headers: { origin, cookie, 'content-type': 'application/json' }, body
			});
			expect(response.status).toBe(expected);
		}
		expect((await fetch(`${base}/api/admin/imports/obsidian`, {
			method: 'POST', headers: { origin: 'https://evil.test', cookie: adminCookie, 'content-type': 'application/json' }, body
		})).status).toBe(403);
	});

	it('validates visibility before creating any posts', async () => {
		const response = await fetch(`${base}/api/admin/imports/obsidian`, {
			method: 'POST', headers: { origin, cookie: adminCookie, 'content-type': 'application/json' },
			body: JSON.stringify({ visibility: 'unknown', files: [{ path: 'Note.md', source: 'body' }] })
		});
		expect(response.status).toBe(400);
		expect((await repos.posts.listAdmin({ limit: 25, offset: 0 })).total).toBe(0);
	});

	it('imports private notes for administrators and masks them from public and reader APIs', async () => {
		const response = await fetch(`${base}/api/admin/imports/obsidian`, {
			method: 'POST', headers: { origin, cookie: adminCookie, 'content-type': 'application/json' }, body
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ created: ['secret'], errors: [] });
		for (const cookie of ['', readerCookie]) {
			expect((await fetch(`${base}/api/posts/secret`, { headers: { cookie } })).status).toBe(404);
			const list = await fetch(`${base}/api/posts`, { headers: { cookie } });
			expect(await list.text()).not.toContain('Secret');
		}
		const post = await repos.posts.findBySlug('secret');
		expect(post?.authorId).toBeTruthy();
		const adminView = await fetch(`${base}/api/admin/posts/${post?.id}`, { headers: { cookie: adminCookie } });
		expect(await adminView.text()).toContain('Private payload');
	});
});
