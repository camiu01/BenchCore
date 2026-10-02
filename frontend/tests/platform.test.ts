/**
 * @file platform.test.ts
 * @brief Unified routing, probe failures, spoof resistance and bridge target regression checks.
 */
import { createServer, type IncomingMessage } from 'node:http';
import { once } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { platformSettings, requestAddress } from '../../runtime/settings.mjs';
import { createBridge } from '../../runtime/bridge.mjs';
import { createPlatformHandler } from '../../runtime/router.mjs';
import { apiFetch } from '../src/lib/server/transport.js';

afterEach(() => {
	vi.unstubAllGlobals();
	delete (globalThis as unknown as Record<symbol, unknown>)[Symbol.for('publishing.api.fetch')];
});
const env = {
	DATABASE_URL: 'postgres://test:test@localhost/publishing_test',
	SITE_URL: 'https://blog.example.test'
};

describe('single-origin beta runtime', () => {
	it('requires a PostgreSQL URL and explicit HTTPS in public production', () => {
		expect(() => platformSettings({ NODE_ENV: 'production' })).toThrow();
		expect(() =>
			platformSettings({ ...env, SITE_URL: 'http://public.example.test', NODE_ENV: 'production' })
		).toThrow();
		expect(() => platformSettings({ ...env, DATABASE_URL: 'https://not-a-db.test' })).toThrow();
		expect(() => platformSettings({ ...env, TRUSTED_PROXY_IPS: '*' })).toThrow();
		expect(platformSettings({ ...env, NODE_ENV: 'production' }).origin.origin).toBe(env.SITE_URL);
	});
	it('never trusts forwarded chains or arbitrary peers', () => {
		const request = {
			socket: { remoteAddress: '127.0.0.1' },
			headers: { 'x-forwarded-for': '203.0.113.10' }
		} as unknown as IncomingMessage;
		expect(requestAddress(request, new Set())).toBe('127.0.0.1');
		expect(requestAddress(request, new Set(['127.0.0.1']))).toBe('203.0.113.10');
		request.headers['x-forwarded-for'] = '203.0.113.10, 203.0.113.20';
		expect(requestAddress(request, new Set(['127.0.0.1']))).toBe('127.0.0.1');
	});
	it('strips forged bridge headers and routes only the /api boundary to the API', async () => {
		const bridge = createBridge();
		const server = createServer(
			createPlatformHandler({
				api: (req, res) => {
					expect(req.headers['x-platform-peer']).toBeUndefined();
					res.end('api');
				},
				frontend: (req, res) => {
					expect(req.headers['x-platform-host']).toBe('blog.example.test');
					res.end('frontend');
				},
				ready: async () => {
					throw new Error('private details');
				},
				settings: platformSettings(env),
				context: bridge.context
			})
		);
		server.listen(0, '127.0.0.1');
		await once(server, 'listening');
		const address = server.address();
		expect(address && typeof address !== 'string').toBe(true);
		const base = `http://127.0.0.1:${typeof address === 'object' ? address?.port : 0}`;
		try {
			for (const path of ['/api', '/api/auth/me', '/api/media/image.png']) {
				expect(
					await (await fetch(base + path, { headers: { 'x-platform-peer': 'evil' } })).text()
				).toBe('api');
			}
			expect(await (await fetch(base + '/apiculture')).text()).toBe('frontend');
			expect((await fetch(base + '/health/live')).status).toBe(200);
			const ready = await fetch(base + '/health/ready');
			expect(ready.status).toBe(503);
			expect(await ready.text()).not.toContain('private details');
			expect((await fetch(base + '/health', { method: 'POST' })).status).toBe(405);
		} finally {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	});
	it('limits the SSR bridge to its private origin and /api paths', async () => {
		const bridge = createBridge();
		await expect(
			bridge.fetch('http://127.0.0.1:9876', 'https://evil.example/api/posts')
		).rejects.toThrow();
		await expect(
			bridge.fetch('http://127.0.0.1:9876', 'http://127.0.0.1:9876/not-api')
		).rejects.toThrow();
		const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
		vi.stubGlobal('fetch', fetcher);
		await bridge.context.run('203.0.113.7', () =>
			bridge.fetch('http://127.0.0.1:9876', 'http://127.0.0.1:9876/api/posts')
		);
		const headers = fetcher.mock.calls[0]![1].headers as Headers;
		expect(headers.get('x-platform-peer')).toBe('203.0.113.7');
		const req = {
			headers: Object.fromEntries(headers),
			socket: { remoteAddress: '127.0.0.1' }
		} as unknown as IncomingMessage;
		expect(bridge.address(req)).toBe('203.0.113.7');
		req.headers['x-platform-bridge'] = 'f'.repeat(64);
		expect(bridge.address(req)).toBe('127.0.0.1');
	});
	it('uses only the installed server bridge, with standalone fetch as fallback', async () => {
		const network = vi.fn().mockResolvedValue(new Response('{}'));
		vi.stubGlobal('fetch', network);
		await apiFetch('http://localhost:5181/api/posts');
		expect(network).toHaveBeenCalledOnce();
		const bridge = vi.fn().mockResolvedValue(new Response('{}'));
		(globalThis as unknown as Record<symbol, unknown>)[Symbol.for('publishing.api.fetch')] = bridge;
		await apiFetch('http://localhost:5181/api/posts');
		expect(bridge).toHaveBeenCalledOnce();
		expect(network).toHaveBeenCalledOnce();
	});
});
