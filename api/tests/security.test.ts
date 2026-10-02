/**
 * @file security.test.ts
 * @brief Regression coverage for API origin, rate, privacy, transport and authorization rules.
 */
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createHandler, startServer, type ApiDeps } from '../src/server.js';
import { configuredOrigins } from '../src/http/security.js';
import { createPost } from '../src/posts/post-service.js';
import { createSessionToken, buildSessionExpiry, parseCookies } from '../src/auth/session.js';
import { hashPassword } from '../src/auth/password.js';
import { createTestDeps, createTestRepos } from './helpers.js';

const origin = 'http://localhost:5173';

/**
 * @brief Runs a callback against an isolated API instance.
 * @param deps Handler dependencies.
 * @param check Callback with the ephemeral URL.
 * @return Nothing.
 */
async function withApi(deps: ApiDeps, check: (base: string) => Promise<void>): Promise<void> {
	const server = startServer(0, createHandler(deps), '127.0.0.1');
	await new Promise<void>((resolve) => server.once('listening', resolve));
	try { await check(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); }
	finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

describe('origin and transport protection', () => {
	it('rejects missing, null, suffix and foreign origins before authentication', async () => {
		await withApi(createTestDeps(createTestRepos()), async (base) => {
			for (const value of [undefined, 'null', `${origin}.evil.test`, 'https://evil.test']) {
				const response = await fetch(`${base}/api/auth/login`, {
					method: 'POST', headers: value ? { origin: value } : {}
				});
				expect(response.status).toBe(403);
				expect(response.headers.get('cache-control')).toBe('no-store');
			}
			expect((await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { origin } })).status).toBe(400);
		});
	});

	it('returns 413 for oversized JSON without resetting the connection', async () => {
		await withApi(createTestDeps(createTestRepos()), async (base) => {
			const response = await fetch(`${base}/api/auth/login`, {
				method: 'POST', headers: { origin }, body: JSON.stringify({ data: 'a'.repeat(300_000) })
			});
			expect(response.status).toBe(413);
			expect(await response.json()).toMatchObject({ error: 'too_large' });
		});
	});

	it('sets security headers on unknown paths and gives unknown API paths 404', async () => {
		await withApi(createTestDeps(createTestRepos()), async (base) => {
			const response = await fetch(`${base}/api/unknown`);
			expect(response.status).toBe(404);
			expect(response.headers.get('x-content-type-options')).toBe('nosniff');
			expect(response.headers.get('x-frame-options')).toBe('DENY');
			expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
			const wrongMethod = await fetch(`${base}/api/posts`, { method: 'PATCH', headers: { origin } });
			expect(wrongMethod.status).toBe(405);
			expect(wrongMethod.headers.get('allow')).toBe('GET, POST');
		});
	});

	it('fails closed for missing production origins and malformed settings', () => {
		expect(() => configuredOrigins({ NODE_ENV: 'production' })).toThrow();
		for (const value of ['null', '*', 'https://site.test/path', 'https://a:b@site.test']) {
			expect(() => configuredOrigins({ SITE_URL: value })).toThrow();
		}
		expect(configuredOrigins({ SITE_URL: 'https://site.test' })).toEqual(['https://site.test']);
	});

	it('ignores malformed cookie escapes without prototype pollution', () => {
		const cookies = parseCookies('session=%; __proto__=x; valid=ok');
		expect(cookies['session']).toBeUndefined();
		expect(cookies['valid']).toBe('ok');
		expect(Object.getPrototypeOf(cookies)).toBeNull();
	});
});

describe('bounded rate limits', () => {
	it('returns Retry-After, ignores spoofed proxy headers and resets the window', async () => {
		const deps = createTestDeps(createTestRepos());
		deps.rateLimit = { windowMs: 100, requests: 1, loginRequests: 1 };
		await withApi(deps, async (base) => {
			expect((await fetch(`${base}/health`)).status).toBe(200);
			const limited = await fetch(`${base}/health`, { headers: { 'x-forwarded-for': '192.0.2.4' } });
			expect(limited.status).toBe(429);
			expect(limited.headers.get('retry-after')).toBe('1');
			await new Promise((resolve) => setTimeout(resolve, 120));
			expect((await fetch(`${base}/health`)).status).toBe(200);
		});
	});

	it('applies a separate login quota without blocking ordinary reads', async () => {
		const deps = createTestDeps(createTestRepos());
		deps.rateLimit = { windowMs: 60_000, requests: 10, loginRequests: 1 };
		await withApi(deps, async (base) => {
			await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { origin } });
			expect((await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { origin } })).status).toBe(429);
			expect((await fetch(`${base}/health`)).status).toBe(200);
		});
	});
});

describe('publication privacy and roles', () => {
	it('creates a session from a case-insensitive username', async () => {
		const repos = createTestRepos();
		await repos.users.create({
			id: randomUUID(), email: 'admin@example.test', username: 'ExampleAdmin',
			name: 'Admin', role: 'admin', passwordHash: await hashPassword('test-only-password')
		});
		await withApi(createTestDeps(repos), async (base) => {
			const response = await fetch(`${base}/api/auth/login`, {
				method: 'POST', headers: { origin, 'content-type': 'application/json' },
				body: JSON.stringify({ username: 'EXAMPLEADMIN', password: 'test-only-password' })
			});
			expect(response.status).toBe(200);
			expect(response.headers.getSetCookie()).toHaveLength(1);
			expect(await response.json()).toMatchObject({ user: { name: 'Admin', role: 'admin' } });
		});
	});

	it('does not disclose tags used only on draft, archived or future posts', async () => {
		const repos = createTestRepos();
		await createPost(repos, { title: 'Private', slug: 'private', contentMarkdown: 'hidden', tags: ['secret-topic'] });
		await createPost(repos, { title: 'Public', slug: 'public', contentMarkdown: 'shown', status: 'published', tags: ['visible'] });
		await withApi(createTestDeps(repos), async (base) => {
			const response = await fetch(`${base}/api/tags`);
			expect(await response.json()).toMatchObject({ items: [{ name: 'visible', count: 1 }] });
		});
	});

	it('rejects non-admin owners and safely handles invalid UUIDs', async () => {
		const repos = createTestRepos();
		const user = await repos.users.create({
			id: randomUUID(), email: 'reader@example.test', name: 'Reader', passwordHash: 'unused', role: 'reader'
		});
		const session = createSessionToken();
		await repos.sessions.create({ id: randomUUID(), userId: user.id, tokenHash: session.tokenHash, expiresAt: buildSessionExpiry() });
		await withApi(createTestDeps(repos), async (base) => {
			const response = await fetch(`${base}/api/admin/posts`, { headers: { cookie: `session=${session.token}` } });
			expect(response.status).toBe(403);
		});
	});

	it('keeps the complete tag registry behind an administrator session', async () => {
		const repos = createTestRepos();
		await createPost(repos, { title: 'Private', slug: 'private', contentMarkdown: 'Body', tags: ['draft-only'] });
		const user = await repos.users.create({
			id: randomUUID(), email: 'admin@example.test', name: 'Admin', passwordHash: 'unused', role: 'admin'
		});
		const session = createSessionToken();
		await repos.sessions.create({ id: randomUUID(), userId: user.id, tokenHash: session.tokenHash, expiresAt: buildSessionExpiry() });
		await withApi(createTestDeps(repos), async (base) => {
			expect((await fetch(`${base}/api/admin/tags`)).status).toBe(401);
			const response = await fetch(`${base}/api/admin/tags`, { headers: { cookie: `session=${session.token}` } });
			expect(await response.json()).toMatchObject({ items: [{ name: 'draft-only', count: 0 }] });
			expect((await fetch(`${base}/api/admin/posts/not-a-uuid`, { headers: { cookie: `session=${session.token}` } })).status).toBe(404);
		});
	});

	it('searches visible posts and validates search bounds at the API boundary', async () => {
		const repos = createTestRepos();
		await createPost(repos, { title: 'Gearbox', slug: 'gearbox', contentMarkdown: 'transmission', status: 'published' });
		await createPost(repos, { title: 'Gearbox secret', slug: 'hidden', contentMarkdown: 'transmission' });
		await withApi(createTestDeps(repos), async (base) => {
			const response = await fetch(`${base}/api/posts?search=gearbox`);
			expect(await response.json()).toMatchObject({ total: 1, items: [{ slug: 'gearbox' }] });
			expect((await fetch(`${base}/api/posts?search=${'a'.repeat(201)}`)).status).toBe(400);
			expect((await fetch(`${base}/api/posts?limit=0`)).status).toBe(400);
		});
	});
});
