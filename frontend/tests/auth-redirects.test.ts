/**
 * @file auth-redirects.test.ts
 * @brief Authentication redirects preserve SvelteKit data navigation semantics.
 */
import { redirect } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handle } from '../src/hooks.server.js';
import { resolveSessionUser } from '../src/lib/server/session.js';

vi.mock('../src/lib/server/session.js', () => ({ resolveSessionUser: vi.fn() }));

/**
 * @brief Builds the request fields used by the authentication hook.
 * @param path Local route path.
 * @param isDataRequest Whether SvelteKit is loading navigation data.
 * @param resolve Request resolver.
 * @return Hook input.
 */
function input(path: string, isDataRequest: boolean, resolve = async () => new Response('ok')) {
	const url = new URL(path, 'http://localhost:5173');
	return {
		event: {
			url,
			request: new Request(url),
			locals: {},
			isDataRequest,
			cookies: { get: () => undefined }
		},
		resolve
	} as unknown as Parameters<typeof handle>[0];
}

beforeEach(() => {
	vi.mocked(resolveSessionUser).mockResolvedValue(null);
});

describe('authentication redirects', () => {
	it('lets SvelteKit serialize the login redirect for protected data requests', async () => {
		await expect(handle(input('/admin/import', true))).rejects.toMatchObject({
			status: 303,
			location: '/login'
		});
	});

	it('keeps document redirects private and non-cacheable', async () => {
		const response = await handle(input('/admin/import', false));
		expect(response.status).toBe(303);
		expect(response.headers.get('location')).toBe('/login');
		expect(response.headers.get('cache-control')).toBe('no-store');
	});

	it('does not turn page-load redirects into ordinary HTTP responses during data navigation', async () => {
		await expect(
			handle(
				input('/login', true, async () => {
					throw redirect(303, '/admin');
				})
			)
		).rejects.toMatchObject({ status: 303, location: '/admin' });
	});
});
