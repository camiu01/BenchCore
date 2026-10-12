/**
 * @file security-actions.test.ts
 * @brief Browser factor validation, credential non-reflection and all-device session clearing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { actions as security } from '../src/routes/account/security/+page.server.js';
import { actions as login } from '../src/routes/login/+page.server.js';
import { actions as deck } from '../src/routes/admin/+page.server.js';
import { auditPage, factorStatus } from '../src/lib/server/security-api.js';
import { handle } from '../src/hooks.server.js';
import { secureResponse } from '../src/lib/server/security.js';
import { createTotpQr } from '../src/lib/server/totp-qr.js';

const admin = {
	id: '00000000-0000-4000-8000-000000000001',
	name: 'Admin',
	email: 'operator@example.test',
	role: 'admin'
};
afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

/** @brief Builds a private form request. @param fields Form values. @return Request. */
function request(fields: Record<string, string>) {
	const form = new FormData();
	for (const [name, value] of Object.entries(fields)) {
		form.set(name, value);
	}
	return new Request('http://localhost:5173/account/security', { method: 'POST', body: form });
}

describe('account security browser actions', () => {
	it('denies reader factor mutations before contacting the API', async () => {
		const fetcher = vi.fn();
		vi.stubGlobal('fetch', fetcher);
		for (const action of [security.enroll!, security.enable!, security.disable!]) {
			const result = await action({
				locals: { user: { ...admin, role: 'reader' } },
				request: request({})
			} as unknown as Parameters<typeof action>[0]);
			expect(result).toMatchObject({ status: 403 });
		}
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('clears the browser cookie after factor changes and global logout', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: true })));
		for (const action of [security.enable!, security.disable!, security.logoutAll!]) {
			const cookies = { delete: vi.fn() };
			await expect(
				action({
					locals: { user: admin },
					cookies,
					request: request({
						password: 'private-password',
						code: '123456',
						ticket: 'encrypted-ticket'
					})
				} as unknown as Parameters<typeof action>[0])
			).rejects.toMatchObject({ location: '/login' });
			expect(cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
		}
	});
	it('reflects only validated enrollment fields, not passwords or upstream diagnostics', async () => {
		vi.stubEnv('SITE_URL', 'https://canonical.example.test');
		const fetcher = vi.fn().mockResolvedValue(
			Response.json({
				secret: 'A'.repeat(32),
				ticket: 'encrypted-ticket',
				uri: 'otpauth://totp/BenchCore%3Aoperator%40example.test?secret=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&issuer=BenchCore&algorithm=SHA1&digits=6&period=30',
				password: 'private-password',
				diagnostic: 'private'
			})
		);
		vi.stubGlobal('fetch', fetcher);
		const result = await security.enroll!({
			locals: { user: admin },
			request: request({ password: 'private-password' })
		} as unknown as Parameters<NonNullable<typeof security.enroll>>[0]);
		expect(result).toEqual({
			enrollment: {
				secret: 'A'.repeat(32),
				ticket: 'encrypted-ticket',
				qr: createTotpQr(
					'otpauth://totp/BenchCore%3Aoperator%40example.test?secret=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&issuer=BenchCore&algorithm=SHA1&digits=6&period=30'
				)
			}
		});
		expect(JSON.stringify(result)).not.toContain('private');
		expect(fetcher.mock.calls[0]![1].headers.origin).toBe('https://canonical.example.test');
	});
	it('rejects invalid codes without returning credentials or issuing a request', async () => {
		const fetcher = vi.fn();
		vi.stubGlobal('fetch', fetcher);
		const result = await security.enable!({
			locals: { user: admin },
			request: request({
				password: 'private-password',
				code: 'bad',
				ticket: 'private-ticket'
			})
		} as unknown as Parameters<NonNullable<typeof security.enable>>[0]);
		expect(result).toMatchObject({ status: 400 });
		expect(JSON.stringify(result)).not.toContain('private');
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('passes six-digit login codes as strings and never reflects them on denial', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(Response.json({ error: 'unauthorized' }, { status: 401 }));
		vi.stubGlobal('fetch', fetcher);
		const result = await login.login!({
			request: request({
				email: 'operator',
				password: 'private-password',
				code: '001234'
			}),
			cookies: { set: vi.fn() }
		} as unknown as Parameters<NonNullable<typeof login.login>>[0]);
		expect(JSON.parse(fetcher.mock.calls[0]![1].body).code).toBe('001234');
		expect(JSON.stringify(result)).not.toContain('001234');
		expect(JSON.stringify(result)).not.toContain('private-password');
	});
	it('rejects unconfirmed bulk deletion before forwarding selected ids', async () => {
		const fetcher = vi.fn().mockResolvedValue(Response.json({ count: 1 }));
		vi.stubGlobal('fetch', fetcher);
		const action = deck.deleteSelected!;
		const denied = await action({
			locals: { user: admin },
			request: request({ ids: admin.id, confirmation: 'no' })
		} as unknown as Parameters<typeof action>[0]);
		expect(denied).toMatchObject({ status: 400 });
		expect(fetcher).not.toHaveBeenCalled();
		const accepted = await action({
			locals: { user: admin },
			request: request({ ids: admin.id, confirmation: 'DELETE' })
		} as unknown as Parameters<typeof action>[0]);
		expect(accepted).toEqual({ deleted: 1 });
		expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({
			ids: [admin.id],
			confirmation: 'DELETE'
		});
	});
	it('validates factor and audit projections, treating malformed responses as unavailable', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ enabled: 'yes' })));
		expect(await factorStatus('session=fixture')).toBeNull();
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				Response.json({
					items: [{ action: 'unknown', password: 'private' }],
					hasMore: false
				})
			)
		);
		expect(await auditPage('session=fixture', 0)).toBeNull();
	});
	it('guards nested account settings and prevents indexing or caching them', async () => {
		const url = new URL('http://localhost:5173/account/security');
		const event = {
			url,
			request: new Request(url),
			cookies: { get: () => undefined },
			locals: { user: null }
		};
		const resolve = vi.fn();
		const response = await handle({
			event: event as unknown as Parameters<typeof handle>[0]['event'],
			resolve
		});
		expect(response.status).toBe(303);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(resolve).not.toHaveBeenCalled();
		const secured = secureResponse(new Response('settings'), event);
		expect(secured.headers.get('cache-control')).toBe('no-store');
		expect(secured.headers.get('x-robots-tag')).toBe('noindex, nofollow');
	});
});
