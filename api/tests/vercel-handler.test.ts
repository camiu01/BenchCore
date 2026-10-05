/**
 * @file vercel-handler.test.ts
 * @brief Independent API service preserves public paths, security and lazy generic readiness.
 */
import { describe, expect, it, vi } from 'vitest';
import { createVercelHandler } from '../src/serverless/handler.js';
import { nodeHandlerFetch } from '../src/http/web.js';
import { createHandler } from '../src/server.js';
import type { createServerlessApp } from '../src/serverless/app.js';
import { createTestDeps, createTestRepos } from './helpers.js';
import service from '../src/vercel.js';

describe('independent Vercel API service', () => {
	it('exports the backend Fetch contract without starting a listener', async () => {
		const response = await service.fetch(new Request('https://site.test/health/live'));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: 'ok' });
	});
	it('keeps liveness independent from database and media configuration', async () => {
		const factory = vi.fn<typeof createServerlessApp>().mockImplementation(() => { throw new Error('private configuration'); });
		const handler = createVercelHandler({ NODE_ENV: 'production' }, factory);
		for (const path of ['/health', '/health/live']) {
			const response = await nodeHandlerFetch(handler, new Request(`https://site.test${path}`), 'peer');
			expect(response.status).toBe(200);
			expect(response.headers.get('cache-control')).toBe('no-store');
		}
		expect(factory).not.toHaveBeenCalled();
		const failed = await nodeHandlerFetch(handler, new Request('https://site.test/health/ready'), 'peer');
		expect(failed.status).toBe(503);
		expect(await failed.text()).not.toContain('private configuration');
	});
	it('preserves /api routes, authentication and exact-Origin rejection', async () => {
		const api = createHandler(createTestDeps(createTestRepos()));
		const ready = vi.fn().mockResolvedValue(undefined);
		const factory = vi.fn().mockReturnValue({ handler: api, ready, fetch: vi.fn() });
		const handler = createVercelHandler({}, factory);
		expect((await nodeHandlerFetch(handler, new Request('https://site.test/api/posts'), 'peer')).status).toBe(200);
		expect((await nodeHandlerFetch(handler, new Request('https://site.test/api/admin/users'), 'peer')).status).toBe(401);
		const rejected = new Request('https://site.test/api/auth/register', { method: 'POST', headers: { origin: 'https://evil.test' }, body: '{}' });
		expect((await nodeHandlerFetch(handler, rejected, 'peer')).status).toBe(403);
		expect((await nodeHandlerFetch(handler, new Request('https://site.test/health/ready'), 'peer')).status).toBe(200);
		expect(factory).toHaveBeenCalledOnce();
		expect(ready).toHaveBeenCalledOnce();
	});
	it('rejects non-GET health methods without initialization', async () => {
		const factory = vi.fn<typeof createServerlessApp>();
		const response = await nodeHandlerFetch(createVercelHandler({}, factory), new Request('https://site.test/health', { method: 'POST' }), 'peer');
		expect(response.status).toBe(405);
		expect(response.headers.get('allow')).toBe('GET');
		expect(factory).not.toHaveBeenCalled();
	});
});