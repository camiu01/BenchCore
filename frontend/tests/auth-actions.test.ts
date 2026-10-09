/**
 * @file auth-actions.test.ts
 * @brief Regression coverage for browser CSRF, trusted upstream origins and private redirects.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { redirect } from '@sveltejs/kit';
import { handle } from '../src/hooks.server.js';
import { actions } from '../src/routes/login/+page.server.js';
import { POST as logout } from '../src/routes/logout/+server.js';
import { actions as newPostActions } from '../src/routes/admin/posts/new/+page.server.js';
import { actions as editPostActions } from '../src/routes/admin/posts/[id]/+page.server.js';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

/**
 * @brief Creates a minimal hook event for frontend security tests.
 * @param path The frontend path.
 * @param method The request method.
 * @param origin The optional presented origin.
 * @return The test event.
 */
function hookEvent(path: string, method = 'GET', origin?: string) {
	const url = new URL(path, 'http://localhost:5173');
	return {
		url,
		locals: { user: null },
		cookies: { get: () => undefined },
		request: new Request(url, { method, headers: origin === undefined ? {} : { origin } })
	} as unknown as Parameters<typeof handle>[0]['event'];
}

describe('frontend origin and auth guards', () => {
	it.each([undefined, 'https://evil.example', 'http://localhost:5173.evil.example'])(
		'rejects untrusted browser mutations from %s before accessing the API',
		async (origin) => {
			const resolve = vi.fn();
			const fetcher = vi.fn();
			vi.stubGlobal('fetch', fetcher);
			const response = await handle({ event: hookEvent('/logout', 'POST', origin), resolve });
			expect(response.status).toBe(403);
			expect(response.headers.get('cache-control')).toBe('no-store');
			expect(resolve).not.toHaveBeenCalled();
			expect(fetcher).not.toHaveBeenCalled();
		}
	);

	it('guards unauthenticated admin requests with non-cacheable redirects', async () => {
		const resolve = vi.fn();
		const response = await handle({ event: hookEvent('/admin/posts/new'), resolve });
		expect(response.status).toBe(303);
		expect(response.headers.get('location')).toBe('/login');
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(resolve).not.toHaveBeenCalled();
	});

	it('allows exact browser origins and preserves framework CSP', async () => {
		const resolve = vi.fn().mockResolvedValue(
			new Response('ok', {
				headers: { 'content-security-policy': "script-src 'nonce-framework'" }
			})
		);
		const response = await handle({
			event: hookEvent('/login', 'POST', 'http://localhost:5173'),
			resolve
		});
		expect(response.status).toBe(200);
		expect(response.headers.get('content-security-policy')).toContain('nonce-framework');
		expect(response.headers.get('cache-control')).toBe('no-store');
	});

	it('adds no-store to action redirects thrown by the resolver', async () => {
		const response = await handle({
			event: hookEvent('/login'),
			resolve: async () => {
				redirect(303, '/admin');
			}
		});
		expect(response.status).toBe(303);
		expect(response.headers.get('cache-control')).toBe('no-store');
	});
});

describe('trusted auth action origins', () => {
	it('accepts a username without requiring an email-shaped browser input', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			Response.json(
				{
					user: {
						id: '00000000-0000-4000-8000-000000000001',
						email: 'admin@example.test',
						name: 'Admin',
						role: 'admin'
					}
				},
				{ headers: { 'set-cookie': `session=${'a'.repeat(43)}; Max-Age=2592000` } }
			)
		);
		vi.stubGlobal('fetch', fetcher);
		const form = new FormData();
		form.set('email', 'ExampleAdmin');
		form.set('password', 'test-only-password');
		const request = new Request('http://localhost/login', { method: 'POST', body: form });
		const cookies = { set: vi.fn() };
		await expect(
			actions.login!({ request, cookies } as unknown as Parameters<
				NonNullable<typeof actions.login>
			>[0])
		).rejects.toMatchObject({ status: 303 });
		expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toMatchObject({ email: 'ExampleAdmin' });
	});

	it('forwards configured Origin on login and stores a validated session', async () => {
		vi.stubEnv('SITE_URL', 'https://configured.example.com');
		const fetcher = vi.fn().mockResolvedValue(
			Response.json(
				{
					user: {
						id: '00000000-0000-4000-8000-000000000001',
						email: 'admin@example.test',
						name: 'Admin',
						role: 'admin'
					}
				},
				{
					headers: { 'set-cookie': `session=${'a'.repeat(43)}; HttpOnly; Max-Age=2592000` }
				}
			)
		);
		vi.stubGlobal('fetch', fetcher);
		const form = new FormData();
		form.set('email', 'admin@example.com');
		form.set('password', 'secret');
		const request = new Request('http://localhost:5173/login', {
			method: 'POST',
			headers: { origin: 'https://untrusted.example' },
			body: form
		});
		const cookies = { set: vi.fn() };
		await expect(
			actions.login!({ request, cookies } as unknown as Parameters<
				NonNullable<typeof actions.login>
			>[0])
		).rejects.toMatchObject({ status: 303, location: '/admin' });
		expect(fetcher.mock.calls[0]![1].headers.origin).toBe('https://configured.example.com');
		expect(cookies.set).toHaveBeenCalled();
	});

	it('rejects invalid credentials without contacting the API', async () => {
		const fetcher = vi.fn();
		vi.stubGlobal('fetch', fetcher);
		const request = new Request('http://localhost/login', { method: 'POST', body: new FormData() });
		const result = await actions.login!({ request } as Parameters<
			NonNullable<typeof actions.login>
		>[0]);
		expect(result).toMatchObject({ status: 400 });
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('preserves rate-limit failures instead of reporting invalid credentials', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 429 })));
		const form = new FormData();
		form.set('email', 'admin@example.com');
		form.set('password', 'secret');
		const request = new Request('http://localhost/login', { method: 'POST', body: form });
		const result = await actions.login!({ request } as Parameters<
			NonNullable<typeof actions.login>
		>[0]);
		expect(result).toMatchObject({ status: 429 });
	});

	it('forwards trusted Origin on logout and clears the local session during outages', async () => {
		vi.stubEnv('SITE_URL', 'https://configured.example.com');
		const fetcher = vi.fn().mockRejectedValue(new Error('offline'));
		vi.stubGlobal('fetch', fetcher);
		const cookies = { delete: vi.fn() };
		const request = new Request('http://localhost/logout', {
			method: 'POST',
			headers: { cookie: 'session=token', origin: 'https://untrusted.example' }
		});
		const response = await logout({ request, cookies } as unknown as Parameters<typeof logout>[0]);
		expect(fetcher.mock.calls[0]![1].headers.origin).toBe('https://configured.example.com');
		expect(cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
		expect(response.status).toBe(303);
	});
});

describe('uploads preserve editor state in both routes', () => {
	it.each([newPostActions.upload!, editPostActions.upload!])(
		'appends media without discarding submitted fields',
		async (upload) => {
			const key = `${'b'.repeat(32)}.png`;
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(
					Response.json(
						{
							url: `/api/media/${key}`
						},
						{ status: 201 }
					)
				)
			);
			const form = new FormData();
			form.set('title', 'Unsaved title');
			form.set('content', 'Unsaved content');
			form.set('publish_at', '2026-12-01T12:00:00Z');
			form.set('image', new File(['png'], 'image.png', { type: 'image/png' }));
			const request = new Request('http://localhost/admin/posts/new', {
				method: 'POST',
				body: form
			});
			const result = await upload({ request } as unknown as Parameters<
				NonNullable<typeof newPostActions.upload>
			>[0] &
				Parameters<NonNullable<typeof editPostActions.upload>>[0]);
			expect(result).toMatchObject({
				values: {
					title: 'Unsaved title',
					publishAt: '2026-12-01T12:00:00Z',
					content: `Unsaved content\n\n![](/api/media/${key})\n`
				},
				uploadedUrl: `/api/media/${key}`
			});
		}
	);
});
