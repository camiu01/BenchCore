/**
 * @file password-reset-delivery.test.ts
 * @brief Resend password recovery configuration and request payload coverage.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configuredPasswordReset } from '../src/auth/password-reset-delivery.js';
import type { UserRow } from '../src/db/schema.js';

afterEach(() => { vi.unstubAllGlobals(); });

const user: UserRow = {
	id: '00000000-0000-4000-8000-000000000001',
	email: 'reader@example.test',
	username: 'reader',
	passwordHash: 'private',
	name: 'Reader <Account>',
	role: 'reader',
	isActive: true,
	sessionVersion: 0,
	createdAt: new Date()
};

describe('Resend password recovery delivery', () => {
	it('sends authenticated text and escaped HTML to the account email', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		vi.stubGlobal('fetch', fetcher);
		const configured = configuredPasswordReset({
			RESEND_API_KEY: 're_test_key',
			PASSWORD_RESET_FROM: 'onboarding@resend.dev',
			SITE_URL: 'https://benchcore.example'
		});
		await configured!.delivery.send(user, 'https://benchcore.example/reset-password?token=fixture');
		expect(fetcher).toHaveBeenCalledOnce();
		expect(fetcher.mock.calls[0]![0]).toBe('https://api.resend.com/emails');
		const options = fetcher.mock.calls[0]![1] as RequestInit;
		expect(options.headers).toMatchObject({ authorization: 'Bearer re_test_key' });
		const payload = JSON.parse(String(options.body)) as Record<string, unknown>;
		expect(payload).toMatchObject({
			from: 'onboarding@resend.dev',
			to: ['reader@example.test'],
			subject: 'Reset your BenchCore password'
		});
		expect(payload['html']).toContain('Reader &lt;Account&gt;');
		expect(payload['text']).toContain('reset-password?token=fixture');
	});

	it('requires the API key, sender and site URL together', () => {
		expect(configuredPasswordReset({})).toBeUndefined();
		expect(() => configuredPasswordReset({ RESEND_API_KEY: 're_test_key' })).toThrow();
	});
});
