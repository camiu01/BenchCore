/**
 * @file service-binding.test.ts
 * @brief Runtime-only API bindings replace public/local targets without leaking to browser media URLs.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBase, getPostsPage, resolveMediaUrl } from '../src/lib/api.js';
import { apiFetch } from '../src/lib/server/transport.js';
import { resolveSessionUser } from '../src/lib/server/session.js';

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	delete (globalThis as unknown as Record<symbol, unknown>)[Symbol.for('publishing.api.fetch')];
});

describe('Vercel service bindings', () => {
	it('declares the one-way binding and exact public routing before catch-all', () => {
		const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
		expect(Object.keys(config.services)).toEqual(['api', 'frontend']);
		expect(config.services.frontend.bindings).toEqual([
			{ type: 'service', service: 'api', format: 'url', env: 'API_SERVICE_URL' }
		]);
		expect(config.services.api.bindings).toBeUndefined();
		expect(config.services.api.entrypoint).toBe('src/vercel.ts');
		expect(config.services.api.buildCommand).toBe('pnpm run build:vercel');
		const api = JSON.parse(
			readFileSync(new URL('../../api/package.json', import.meta.url), 'utf8')
		);
		expect(api.scripts['build:vercel']).toBe(
			'tsc -p tsconfig.build.json --noEmit && node scripts/build-vercel.mjs'
		);
		expect(config.rewrites.at(-1)).toEqual({
			source: '/(.*)',
			destination: { service: 'frontend' }
		});
		expect(
			config.rewrites
				.slice(0, -1)
				.every((rule: { destination: { service: string } }) => rule.destination.service === 'api')
		).toBe(true);
		expect(config.rewrites.map((rule: { source: string }) => rule.source)).toContain('/api');
		expect(config.rewrites.map((rule: { source: string }) => rule.source)).toContain('/health');
		for (const key of [
			'buildCommand',
			'installCommand',
			'framework',
			'functions',
			'outputDirectory'
		]) {
			expect(config[key]).toBeUndefined();
		}
	});
	it('reads the binding at runtime and never falls back to localhost on Vercel', () => {
		vi.stubEnv('API_SERVICE_URL', undefined);
		vi.stubEnv('VERCEL', '1');
		expect(() => apiBase()).toThrow('binding');
		vi.stubEnv('API_SERVICE_URL', 'http://internal-service.test/base/');
		vi.stubEnv('PUBLIC_API_URL', 'https://public.example.test');
		expect(apiBase()).toBe('http://internal-service.test/base');
		vi.stubEnv('API_SERVICE_URL', 'https://second-service.test/');
		expect(apiBase()).toBe('https://second-service.test');
		expect(resolveMediaUrl(`${'a'.repeat(32)}.png`)).toBe(`/api/media/${'a'.repeat(32)}.png`);
	});
	it('rejects malformed, credential-bearing and query-bearing bound URLs', () => {
		for (const value of [
			'',
			'file:///private',
			'https://user:pass@internal.test',
			'https://internal.test/?token=fixture',
			'https://internal.test/#fragment'
		]) {
			vi.stubEnv('API_SERVICE_URL', value);
			expect(() => apiBase()).toThrow();
		}
	});
	it('preserves API paths, cookies and abort signals on internal requests', async () => {
		vi.stubEnv('API_SERVICE_URL', 'http://internal.test/');
		const user = {
			id: 'c9186a45-ea8d-4f2f-96c4-630ffb236750',
			email: 'admin@example.test',
			name: 'Admin',
			role: 'admin'
		};
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ items: [], total: 0 }))
			.mockResolvedValueOnce(Response.json({ user }));
		vi.stubGlobal('fetch', fetcher);
		expect(await getPostsPage(10, 0)).toEqual({ items: [], total: 0 });
		expect(fetcher.mock.calls[0]![0]).toContain('http://internal.test/api/posts?');
		expect(await resolveSessionUser('session=fixture')).toEqual(user);
		expect(fetcher.mock.calls[1]![0]).toBe('http://internal.test/api/auth/me');
		expect(fetcher.mock.calls[1]![1]).toMatchObject({
			headers: { cookie: 'session=fixture' },
			redirect: 'manual'
		});
		expect(fetcher.mock.calls[1]![1].signal).toBeInstanceOf(AbortSignal);
	});
	it('does not invoke the old in-process bridge or follow internal redirects', async () => {
		vi.stubEnv('API_SERVICE_URL', 'http://internal.test');
		const oldBridge = vi.fn();
		(globalThis as unknown as Record<symbol, unknown>)[Symbol.for('publishing.api.fetch')] =
			oldBridge;
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 307 }));
		vi.stubGlobal('fetch', fetcher);
		expect((await apiFetch(`${apiBase()}/api/posts`)).status).toBe(307);
		expect(oldBridge).not.toHaveBeenCalled();
		expect(fetcher.mock.calls[0]![1].redirect).toBe('manual');
	});
});
