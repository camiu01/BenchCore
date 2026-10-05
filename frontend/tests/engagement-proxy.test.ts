/**
 * @file engagement-proxy.test.ts
 * @brief Standalone engagement proxy allowlist and upstream forwarding coverage.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '../src/routes/api/[...path]/+server.js';

afterEach(() => vi.unstubAllGlobals());

/**
 * @brief Builds the minimal request event used by the proxy.
 * @param path API-relative path.
 * @param request Incoming request.
 * @return Route event fixture.
 */
function event(path: string, request = new Request('http://localhost/api/example')) {
	return { params: { path }, request } as Parameters<typeof GET>[0];
}

describe('standalone engagement proxy', () => {
	it('preserves the comment pagination query', async () => {
		const fetcher = vi.fn().mockResolvedValue(Response.json({ items: [], hasMore: false }));
		vi.stubGlobal('fetch', fetcher);
		await GET(
			event(
				'posts/example/comments',
				new Request('http://localhost/api/posts/example/comments?offset=100')
			)
		);
		expect(fetcher.mock.calls[0]![0]).toContain('/api/posts/example/comments?offset=100');
	});
	it('rejects unrelated and private API routes without fetching', async () => {
		const fetcher = vi.fn();
		vi.stubGlobal('fetch', fetcher);
		expect((await GET(event('admin/posts'))).status).toBe(404);
		expect((await GET(event('posts/example'))).status).toBe(404);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('forwards mutation origins, voter cookies and response cookies', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(
				Response.json(
					{ liked: true, count: 1 },
					{ headers: { 'set-cookie': 'like_voter=fixture; HttpOnly; Path=/' } }
				)
			);
		vi.stubGlobal('fetch', fetcher);
		const response = await POST(
			event(
				'posts/example/likes',
				new Request('http://localhost/api/posts/example/likes', {
					method: 'POST',
					headers: { origin: 'http://localhost', cookie: 'like_voter=fixture' }
				})
			)
		);
		expect(response.status).toBe(200);
		expect(response.headers.get('set-cookie')).toContain('like_voter=fixture');
		const headers = fetcher.mock.calls[0]![1].headers as Headers;
		expect(headers.get('origin')).toBe('http://localhost');
		expect(headers.get('cookie')).toBe('like_voter=fixture');
	});

	it('returns a bounded outage response on network failure', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
		expect((await GET(event('posts/example/comments'))).status).toBe(502);
	});
});
