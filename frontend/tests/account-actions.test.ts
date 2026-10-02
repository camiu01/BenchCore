/**
 * @file account-actions.test.ts
 * @brief Password non-reflection, reader isolation, API role selection and session-clearing tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handle } from '../src/hooks.server.js';
import { actions as register } from '../src/routes/register/+page.server.js';
import { actions as account } from '../src/routes/account/+page.server.js';
import { actions as users } from '../src/routes/admin/users/+page.server.js';
import { actions as login } from '../src/routes/login/+page.server.js';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});
const user = {
	id: '00000000-0000-4000-8000-000000000001',
	name: 'Reader',
	email: 'reader@example.test',
	role: 'reader'
};

/** @brief Builds a private form fixture. @param values Fields. @return Request. */
function formRequest(values: Record<string, string>) {
	const form = new FormData();
	for (const [key, value] of Object.entries(values)) {
		form.set(key, value);
	}
	return new Request('http://localhost:5180', { method: 'POST', body: form });
}

describe('account browser boundaries', () => {
	it('never reflects registration passwords in validation feedback', async () => {
		const result = await register.register!({
			request: formRequest({
				username: 'reader',
				email: 'reader@example.test',
				name: 'Reader',
				password: 'private-short',
				confirmation: 'different-private'
			})
		} as Parameters<NonNullable<typeof register.register>>[0]);
		expect(JSON.stringify(result)).not.toContain('private-short');
		expect(JSON.stringify(result)).not.toContain('different-private');
		expect(result).toMatchObject({ status: 400 });
	});
	it('does not forward privilege fields from the public registration form', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
		vi.stubGlobal('fetch', fetcher);
		await expect(
			register.register!({
				request: formRequest({
					username: 'reader',
					email: 'reader@example.test',
					name: 'Reader',
					role: 'admin',
					password: 'long-fixture-password',
					confirmation: 'long-fixture-password'
				})
			} as Parameters<NonNullable<typeof register.register>>[0])
		).rejects.toMatchObject({ location: '/login?registered=1' });
		expect(JSON.parse(fetcher.mock.calls[0]![1].body)).not.toHaveProperty('role');
	});
	it('guards reader admin access while allowing their private account page', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(async () => Response.json({ user }))
		);
		const resolve = vi.fn().mockResolvedValue(new Response('account'));
		const url = new URL('http://localhost:5180/admin/users');
		const event = {
			url,
			locals: { user: null },
			request: new Request(url, { headers: { cookie: 'session=fixture' } })
		} as Parameters<typeof handle>[0]['event'];
		const denied = await handle({ event, resolve });
		expect(denied.status).toBe(403);
		expect(denied.headers.get('cache-control')).toBe('no-store');
		expect(resolve).not.toHaveBeenCalled();
		const accountEvent = { ...event, url: new URL('http://localhost:5180/account') };
		expect((await handle({ event: accountEvent, resolve })).status).toBe(200);
	});
	it('clears the revoked cookie and redirects after an own password change', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: true })));
		const cookies = { delete: vi.fn() };
		await expect(
			account.password!({
				locals: { user },
				cookies,
				request: formRequest({
					currentPassword: 'old-fixture-password',
					newPassword: 'new-fixture-password',
					confirmation: 'new-fixture-password'
				})
			} as unknown as Parameters<NonNullable<typeof account.password>>[0])
		).rejects.toMatchObject({ location: '/login?passwordChanged=1' });
		expect(cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
	});
	it('rejects reader user-management actions before calling the API', async () => {
		const fetcher = vi.fn();
		vi.stubGlobal('fetch', fetcher);
		for (const action of [users.create!, users.update!]) {
			await expect(
				action({ locals: { user }, request: formRequest({}) } as Parameters<typeof action>[0])
			).rejects.toMatchObject({ status: 403 });
		}
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('redirects authenticated readers to /account rather than the admin deck', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				Response.json(
					{ user },
					{
						headers: { 'set-cookie': `session=${'a'.repeat(43)}; Max-Age=2592000` }
					}
				)
			)
		);
		await expect(
			login.login!({
				request: formRequest({ email: 'reader', password: 'fixture' }),
				cookies: { set: vi.fn() }
			} as unknown as Parameters<NonNullable<typeof login.login>>[0])
		).rejects.toMatchObject({ location: '/account' });
	});
	it('fails closed when a cookie is paired with an invalid session DTO', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				Response.json(
					{ user: { role: 'admin' } },
					{
						headers: { 'set-cookie': `session=${'a'.repeat(43)}; Max-Age=2592000` }
					}
				)
			)
		);
		const cookies = { set: vi.fn() };
		const result = await login.login!({
			request: formRequest({ email: 'reader', password: 'fixture' }),
			cookies
		} as unknown as Parameters<NonNullable<typeof login.login>>[0]);
		expect(result).toMatchObject({ status: 502 });
		expect(cookies.set).not.toHaveBeenCalled();
	});
});
