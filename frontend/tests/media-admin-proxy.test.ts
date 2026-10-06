/**
 * @file media-admin-proxy.test.ts
 * @brief Protected media proxy key allowlist, confirmation forwarding and outages.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, DELETE } from '../src/routes/api/admin/media/[key]/+server.js';

afterEach(() => vi.unstubAllGlobals());

/** @brief Builds a minimal media request event. @param key Media key. @param request Request. @return Fixture. */
function event(key: string, request = new Request('http://localhost/api/admin/media/invalid')) {
	return { params: { key }, request } as Parameters<typeof GET>[0];
}

describe('protected media proxy', () => {
	it('forwards only the allowlisted metadata option', async () => {
		const fetcher = vi.fn().mockResolvedValue(Response.json({}));
		vi.stubGlobal('fetch', fetcher);
		const key = `${'a'.repeat(32)}.png`;
		await GET(
			event(key, new Request(`http://localhost/api/admin/media/${key}?details=1&other=ignored`))
		);
		expect(String(fetcher.mock.calls[0]?.[0])).toContain(`/api/admin/media/${key}?details=1`);
		expect(String(fetcher.mock.calls[0]?.[0])).not.toContain('other');
		expect(
			(await GET(event(key, new Request(`http://localhost/api/admin/media/${key}?details=bad`))))
				.status
		).toBe(400);
	});
	it('rejects invalid keys without making upstream requests', async () => {
		const fetcher = vi.fn();
		vi.stubGlobal('fetch', fetcher);
		expect((await GET(event('../private'))).status).toBe(404);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('forwards cookies, exact Origin and deletion confirmation', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', fetcher);
		const key = `${'a'.repeat(32)}.png`;
		const body = JSON.stringify({ version: 'b'.repeat(64) });
		const response = await DELETE(
			event(
				key,
				new Request(`http://localhost/api/admin/media/${key}`, {
					method: 'DELETE',
					headers: {
						cookie: 'session=fixture',
						origin: 'http://localhost',
						'content-type': 'application/json'
					},
					body
				})
			)
		);
		expect(response.status).toBe(204);
		const options = fetcher.mock.calls[0]![1];
		expect(options.method).toBe('DELETE');
		expect(options.body).toBe(body);
		expect(options.headers.get('cookie')).toBe('session=fixture');
		expect(options.headers.get('origin')).toBe('http://localhost');
	});

	it('bounds upstream failures', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
		expect((await GET(event(`${'a'.repeat(32)}.png`))).status).toBe(502);
	});
});
