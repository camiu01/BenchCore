/**
 * @file password-reset-delivery.ts
 * @brief Configurable password reset email delivery through Zoho Mail SMTP.
 */
import nodemailer from 'nodemailer';
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
 * @brief Builds configured Zoho Mail delivery, or disables recovery when entirely unconfigured.
 * @param env Runtime environment.
 * @return Delivery implementation and public site origin.
 */
export function configuredPasswordReset(env: NodeJS.ProcessEnv):
	{ delivery: PasswordResetDelivery; siteUrl: string } | undefined {
	const username = env['ZOHO_SMTP_USER'];
	const password = env['ZOHO_SMTP_PASSWORD'];
	const from = env['PASSWORD_RESET_FROM'] ?? username;
	const rawSiteUrl = env['SITE_URL'] ?? env['PUBLIC_SITE_URL'];
	if (!username && !password) { return undefined; }
	if (!username || !password || !rawSiteUrl) {
		throw new Error('ZOHO_SMTP_USER, ZOHO_SMTP_PASSWORD and SITE_URL are required together');
	}
	const siteUrl = new URL(rawSiteUrl);
	if (!['http:', 'https:'].includes(siteUrl.protocol) || siteUrl.username || siteUrl.password) {
		throw new Error('Invalid password reset site URL');
	}
	const transport = nodemailer.createTransport({
		host: 'smtp.zoho.eu',
		port: 465,
		secure: true,
		auth: { user: username, pass: password },
		connectionTimeout: 10_000,
		greetingTimeout: 10_000,
		socketTimeout: 15_000
	});
	return {
		siteUrl: siteUrl.origin,
		delivery: {
			/** @brief Sends text and HTML reset email variants without exposing SMTP credentials. @param user Recipient. @param resetUrl Link. @return Completion. */
			async send(user, resetUrl) {
				const safeName = escapeHtml(user.name);
				const safeUrl = escapeHtml(resetUrl);
				await transport.sendMail({
					from,
					to: user.email,
					subject: 'Reset your BenchCore password',
					text: `Hello ${user.name},\n\nReset your password within one hour:\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
					html: `<p>Hello ${safeName},</p><p>Use the link below to reset your password within one hour:</p>`
						+ `<p><a href="${safeUrl}">Reset password</a></p>`
						+ '<p>If you did not request this, ignore this email.</p>'
				});
			}
		}
	};
}
