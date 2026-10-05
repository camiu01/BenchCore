/**
 * @file password-reset-delivery.ts
 * @brief Configurable password reset email delivery through the Resend HTTPS API.
 */
import type { UserRow } from '../db/schema.js';

/** @brief Password recovery delivery boundary. */
export interface PasswordResetDelivery {
	/** @brief Sends one recovery link. @param user Recipient. @param resetUrl Trusted reset URL. @return Completion. */
	send(user: UserRow, resetUrl: string): Promise<void>;
}

/**
 * @brief Escapes dynamic values before inserting them into email HTML.
 * @param value Untrusted text.
 * @return HTML-safe text.
 */
function escapeHtml(value: string): string {
	return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;').replaceAll('\'', '&#39;');
}

/**
 * @brief Builds configured Resend delivery, or disables recovery when entirely unconfigured.
 * @param env Runtime environment.
 * @return Delivery implementation and public site origin.
 */
export function configuredPasswordReset(env: NodeJS.ProcessEnv):
	{ delivery: PasswordResetDelivery; siteUrl: string } | undefined {
	const apiKey = env['RESEND_API_KEY'];
	const from = env['PASSWORD_RESET_FROM'];
	const rawSiteUrl = env['SITE_URL'] ?? env['PUBLIC_SITE_URL'];
	if (!apiKey && !from) { return undefined; }
	if (!apiKey || !from || !rawSiteUrl) {
		throw new Error('RESEND_API_KEY, PASSWORD_RESET_FROM and SITE_URL are required together');
	}
	const siteUrl = new URL(rawSiteUrl);
	if (!['http:', 'https:'].includes(siteUrl.protocol) || siteUrl.username || siteUrl.password) {
		throw new Error('Invalid password reset site URL');
	}
	return {
		siteUrl: siteUrl.origin,
		delivery: {
			/** @brief Sends text and HTML reset email variants without exposing the API key. @param user Recipient. @param resetUrl Link. @return Completion. */
			async send(user, resetUrl) {
				const safeName = escapeHtml(user.name);
				const safeUrl = escapeHtml(resetUrl);
				const response = await fetch('https://api.resend.com/emails', {
					method: 'POST',
					headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
					body: JSON.stringify({
						from,
						to: [user.email],
						subject: 'Reset your BenchCore password',
						text: `Hello ${user.name},\n\nReset your password within one hour:\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
						html: `<p>Hello ${safeName},</p><p>Use the link below to reset your password within one hour:</p>`
							+ `<p><a href="${safeUrl}">Reset password</a></p>`
							+ '<p>If you did not request this, ignore this email.</p>'
					}),
					signal: AbortSignal.timeout(10_000)
				});
				if (!response.ok) { throw new Error(`password reset delivery failed (${response.status})`); }
			}
		}
	};
}
