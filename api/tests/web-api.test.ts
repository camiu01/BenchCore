/**
 * @file web-api.test.ts
 * @brief Secured API transport executes without a listener and preserves cookies and byte caps.
 */
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nodeHandlerFetch } from '../src/http/web.js';
import { createHandler } from '../src/server.js';
import { createTestDeps, createTestRepos } from './helpers.js';
import { hashPassword } from '../src/auth/password.js';
import { MAX_MEDIA_BYTES } from '../src/media/storage.js';

const origin = 'http://localhost:5173';
let repos: ReturnType<typeof createTestRepos>;
let handler: ReturnType<typeof createHandler>;
beforeEach(() => { repos = createTestRepos(); handler = createHandler(createTestDeps(repos)); });

/** @brief Dispatches a fixture request without opening TCP ports. */
function request(path: string, method = 'GET', data?: unknown, cookie?: string) {
	return nodeHandlerFetch(handler, new Request(origin + path, { method,
		headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
		...(data === undefined ? {} : { body: JSON.stringify(data) }) }), '203.0.113.1');
}
/** @brief Creates and authenticates an administrator fixture. */
async function adminCookie() {
	await repos.users.create({ id: randomUUID(), username: 'operator', email: 'operator@example.test',
		name: 'Operator', role: 'admin', passwordHash: await hashPassword('test-password-only-long') });
	const response = await request('/api/auth/login', 'POST', { username: 'operator', password: 'test-password-only-long' });
	expect(response.status).toBe(200);
	return response.headers.getSetCookie()[0]!.split(';')[0]!;
}

describe('in-process serverless API', () => {
	it('returns public data and generic health without opening a socket', async () => {
		expect((await request('/health')).status).toBe(200);
		expect(await (await request('/api/posts')).json()).toEqual({ items: [], total: 0 });
		expect((await request('/api/admin/users')).status).toBe(401);
	});
	it('preserves exact-Origin enforcement and bounded JSON parsing', async () => {
		const hostile = new Request(origin + '/api/auth/register', { method: 'POST',
			headers: { origin: 'https://evil.test' }, body: '{}' });
		expect((await nodeHandlerFetch(handler, hostile, 'peer')).status).toBe(403);
		expect((await request('/api/auth/register', 'POST', { padding: 'x'.repeat(300_000) })).status).toBe(413);
	});
	it('retains session cookies and administrator isolation through direct-upload routes', async () => {
		const cookie = await adminCookie();
		const prepare = vi.fn().mockResolvedValue({ uploadUrl: 'https://example.test/upload', ticket: 'ticket' });
		const complete = vi.fn().mockResolvedValue({ key: `${'a'.repeat(32)}.png`, filename: 'x.png', mime: 'image/png', sizeBytes: 5 });
		repos.media.direct = { prepare, complete };
		const data = { filename: 'x.png', mime: 'image/png', sizeBytes: MAX_MEDIA_BYTES };
		expect((await request('/api/media/upload', 'POST', data)).status).toBe(401);
		expect((await request('/api/media/upload', 'POST', data, cookie)).status).toBe(200);
		expect(prepare.mock.calls[0]![0].sizeBytes).toBe(MAX_MEDIA_BYTES);
		expect((await request('/api/media/complete', 'POST', { ticket: 'ticket' }, cookie)).status).toBe(201);
		repos.media.remove = vi.fn().mockResolvedValue(true);
		const removed = await request(`/api/media/${'a'.repeat(32)}.png`, 'DELETE', undefined, cookie);
		expect(removed.status).toBe(204);
		expect(await removed.text()).toBe('');
		expect((await request('/api/auth/logout', 'POST', {}, cookie)).status).toBe(200);
		expect((await request('/api/media/complete', 'POST', { ticket: 'ticket' }, cookie)).status).toBe(401);
	});
	it('rejects reader upload attempts and oversized metadata before touching storage', async () => {
		await request('/api/auth/register', 'POST', { username: 'reader', name: 'Reader',
			email: 'reader@example.test', password: 'test-reader-password-only' });
		const login = await request('/api/auth/login', 'POST', { username: 'reader', password: 'test-reader-password-only' });
		const cookie = login.headers.getSetCookie()[0]!.split(';')[0]!;
		repos.media.direct = { prepare: vi.fn(), complete: vi.fn() };
		expect((await request('/api/media/upload', 'POST', { filename: 'x', mime: 'image/png', sizeBytes: 1 }, cookie)).status).toBe(403);
		const admin = await adminCookie();
		expect((await request('/api/media/upload', 'POST', { padding: 'x'.repeat(17000) }, admin)).status).toBe(413);
		expect((await request('/api/media/upload', 'POST', { filename: 'x', mime: 'image/png', sizeBytes: MAX_MEDIA_BYTES + 1 }, admin)).status).toBe(400);
		expect(repos.media.direct.prepare).not.toHaveBeenCalled();
	});
	it('preserves R2 redirects rather than buffering full images through the function', async () => {
		repos.media.readUrl = vi.fn().mockResolvedValue('https://r2.example.test/signed-image');
		const response = await request(`/api/media/${'a'.repeat(32)}.png`);
		expect(response.status).toBe(307);
		expect(response.headers.get('location')).toBe('https://r2.example.test/signed-image');
		expect(response.headers.get('cache-control')).toBe('no-store');
	});
	it('uses only the hosting peer, not forged forwarding headers', async () => {
		handler = createHandler({ ...createTestDeps(repos), rateLimit: { requests: 1, loginRequests: 1, windowMs: 60000 } });
		const raw = () => new Request(origin + '/health', { headers: { 'x-forwarded-for': randomUUID() } });
		expect((await nodeHandlerFetch(handler, raw(), 'real-peer')).status).toBe(200);
		expect((await nodeHandlerFetch(handler, raw(), 'real-peer')).status).toBe(429);
	});
	it('contains synchronous failures and oversized responses without leaking internals', async () => {
		const throwing = () => { throw new Error('private implementation details'); };
		const failed = await nodeHandlerFetch(throwing, new Request(origin), 'peer');
		expect(failed.status).toBe(503);
		expect(await failed.text()).not.toContain('private implementation details');
		const large = await nodeHandlerFetch((_req, res) => res.end(Buffer.alloc(9 * 1024 * 1024)), new Request(origin), 'peer');
		expect(large.status).toBe(503);
		expect(large.headers.get('cache-control')).toBe('no-store');
	});
	it('honors caller cancellation before invoking handlers and during pending requests', async () => {
		const aborted = AbortSignal.abort();
		const handler = vi.fn();
		await expect(nodeHandlerFetch(handler, new Request(origin, { signal: aborted }), 'peer')).rejects.toThrow();
		expect(handler).not.toHaveBeenCalled();
		const controller = new AbortController();
		const pending = nodeHandlerFetch(handler, new Request(origin, { signal: controller.signal }), 'peer');
		controller.abort();
		await expect(pending).rejects.toThrow();
	});
});
