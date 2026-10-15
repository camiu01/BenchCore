/**
 * @file newsletter-api.test.ts
 * @brief Origin, role and validation guards for newsletter and category HTTP endpoints.
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createHandler } from '../src/server.js';
import { nodeHandlerFetch } from '../src/http/web.js';
import { createMemoryNewsletter } from '../src/db/memory-newsletter.js';
import { createTestDeps, createTestRepos } from './helpers.js';
import { createSessionToken } from '../src/auth/session.js';

/** @brief Creates isolated HTTP dependencies and fake-only delivery. @return Request dispatcher. */
function setup() {
	const deps = createTestDeps(createTestRepos());
	const delivery = { confirm: vi.fn(async () => undefined), send: vi.fn(async () => undefined) };
	deps.newsletter = { repository: createMemoryNewsletter(), mail: {
		delivery, siteUrl: 'https://example.test', tokenKey: 'test-only-newsletter-signing-key-32chars'
	} };
	const handler = createHandler(deps);
	/** @brief Dispatches an API request in memory. @param path Path. @param body Optional JSON. @param cookie Session. @param origin Trusted origin by default. @return Response. */
	const request = (path: string, body?: unknown, cookie = '', origin = 'http://localhost:5173') =>
		nodeHandlerFetch(handler, new Request(`http://localhost:5181${path}`, {
			method: body === undefined ? 'GET' : 'POST', headers: { origin, cookie, 'content-type': 'application/json' },
			...(body === undefined ? {} : { body: JSON.stringify(body) })
		}), '127.0.0.1');
	/** @brief Creates an isolated role-bound session without login or SMTP. @param role Account role. @return Cookie. */
	const session = async (role: 'admin' | 'reader') => {
		const id = randomUUID();
		await deps.users.create({ id, email: `${id}@example.test`, passwordHash: 'unused', name: 'Test', role });
		const { token, tokenHash } = createSessionToken();
		await deps.sessions.create({ id: randomUUID(), userId: id, tokenHash,
			expiresAt: new Date(Date.now() + 60000) });
		return `session=${token}`;
	};
	return { deps, delivery, request, session };
}

describe('newsletter HTTP guards', () => {
	it('requires consent and exact trusted origins before sending confirmation', async () => {
		const context = setup();
		expect((await context.request('/api/newsletter/subscribe', { email: 'a@example.test' })).status).toBe(400);
		expect((await context.request('/api/newsletter/subscribe', { email: 'a@example.test', consent: true }, '', 'https://evil.test')).status).toBe(403);
		expect(context.delivery.confirm).not.toHaveBeenCalled();
		expect((await context.request('/api/newsletter/subscribe', { email: 'a@example.test', consent: true })).status).toBe(202);
		expect(context.delivery.confirm).toHaveBeenCalledTimes(1);
	});
	it('never confirms or unsubscribes through GET requests', async () => {
		const context = setup();
		expect((await context.request('/api/newsletter/confirm')).status).toBe(405);
		expect((await context.request('/api/newsletter/unsubscribe')).status).toBe(405);
	});
	it('rejects anonymous and reader newsletter/category administration', async () => {
		const context = setup();
		expect((await context.request('/api/admin/newsletter')).status).toBe(401);
		const cookie = await context.session('reader');
		expect((await context.request('/api/admin/newsletter', undefined, cookie)).status).toBe(403);
		expect((await context.request('/api/admin/categories', undefined, cookie)).status).toBe(403);
		expect((await context.request('/api/admin/newsletter/send', { id: randomUUID(), confirmation: 'SEND' }, cookie)).status).toBe(403);
	});
	it('saves an admin preview without sending and requires typed send approval', async () => {
		const context = setup();
		const cookie = await context.session('admin');
		const response = await context.request('/api/admin/newsletter', { subject: 'News', body: 'Preview' }, cookie);
		expect(response.status).toBe(201);
		const campaign = z.object({ id: z.uuid() }).parse(await response.json());
		expect(context.delivery.send).not.toHaveBeenCalled();
		expect((await context.request('/api/admin/newsletter/send', { id: campaign.id }, cookie)).status).toBe(400);
		const dashboard = await context.request('/api/admin/newsletter', undefined, cookie);
		expect(dashboard.status).toBe(200);
		expect(await dashboard.text()).not.toContain('@example.test');
	});
	it('fails closed when mail is not enabled', async () => {
		const context = setup();
		delete context.deps.newsletter?.mail;
		expect(await (await context.request('/api/newsletter')).json()).toEqual({ enabled: false });
		expect((await context.request('/api/newsletter/subscribe', { email: 'a@example.test', consent: true })).status).toBe(503);
		expect(context.delivery.confirm).not.toHaveBeenCalled();
	});
});
