/**
 * @file password-reset-delivery.test.ts
 * @brief Zoho SMTP password recovery configuration and message coverage.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configuredPasswordReset } from '../src/auth/password-reset-delivery.js';
import type { UserRow } from '../src/db/schema.js';

const sendMail = vi.hoisted(() => vi.fn());
const createTransport = vi.hoisted(() => vi.fn(() => ({ sendMail })));
vi.mock('nodemailer', () => ({ default: { createTransport } }));

afterEach(() => {
	sendMail.mockReset();
	createTransport.mockClear();
});

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

describe('Zoho password recovery delivery', () => {
	it('sends authenticated text and escaped HTML to the account email', async () => {
		sendMail.mockResolvedValue({ messageId: 'fixture' });
		const configured = configuredPasswordReset({
			ZOHO_SMTP_USER: 'owner@zohomail.eu',
			ZOHO_SMTP_PASSWORD: 'private-app-password',
			PASSWORD_RESET_FROM: 'BenchCore <owner@zohomail.eu>',
			SITE_URL: 'https://benchcore.example'
		});
		await configured!.delivery.send(user, 'https://benchcore.example/reset-password?token=fixture');
		expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
			host: 'smtp.zoho.eu',
			port: 465,
			secure: true,
			auth: { user: 'owner@zohomail.eu', pass: 'private-app-password' }
		}));
		expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
			from: 'BenchCore <owner@zohomail.eu>',
			to: 'reader@example.test',
			subject: 'Reset your BenchCore password'
		}));
		const message = sendMail.mock.calls[0]![0] as Record<string, string>;
		expect(message['html']).toContain('Reader &lt;Account&gt;');
		expect(message['text']).toContain('reset-password?token=fixture');
	});

	it('requires SMTP credentials and a site URL together', () => {
		expect(configuredPasswordReset({})).toBeUndefined();
		expect(() => configuredPasswordReset({ ZOHO_SMTP_USER: 'owner@zohomail.eu' })).toThrow();
	});
});
