/**
 * @file delivery.ts
 * @brief Opt-in newsletter SMTP configuration, disabled unless explicitly configured.
 */
import nodemailer from 'nodemailer';
import type { NewsletterDeps } from './service.js';

/** @brief Configures newsletter mail without sending or enabling it through account settings. @param env Environment. @return Optional mail transport. */
export function configuredNewsletter(env: NodeJS.ProcessEnv): NewsletterDeps['mail'] {
	if (env['NEWSLETTER_ENABLED'] !== 'true') { return undefined; }
	const user = env['ZOHO_SMTP_USER'];
	const pass = env['ZOHO_SMTP_PASSWORD'];
	const tokenKey = env['NEWSLETTER_TOKEN_KEY'];
	const rawUrl = env['SITE_URL'] ?? env['PUBLIC_SITE_URL'];
	if (!user || !pass || !rawUrl || !tokenKey || tokenKey.length < 32) {
		throw new Error('Newsletter requires SMTP credentials, SITE_URL and NEWSLETTER_TOKEN_KEY (at least 32 characters)');
	}
	const site = new URL(rawUrl);
	if (!['https:', 'http:'].includes(site.protocol) || site.username || site.password
		|| (env['NODE_ENV'] === 'production' && site.protocol !== 'https:')) { throw new Error('Invalid newsletter site origin'); }
	const from = env['NEWSLETTER_FROM'] ?? user;
	const transport = nodemailer.createTransport({
		host: 'smtp.zoho.eu', port: 465, secure: true, auth: { user, pass },
		connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
	});
	return {
		siteUrl: site.origin, tokenKey,
		delivery: {
			/** @brief Sends only an explicitly requested opt-in confirmation. @param email Recipient. @param url Confirmation URL. @return Completion. */
			async confirm(email, url) {
				await transport.sendMail({ from, to: email, subject: 'Confirm your BenchCore newsletter subscription',
					text: `Confirm your newsletter subscription within 24 hours:\n${url}\n\nConferma l’iscrizione alla newsletter entro 24 ore.\nIf you did not request this, ignore this email. Se non hai richiesto l’iscrizione, ignora questa email.` });
			},
			/** @brief Sends separate plain-text messages, never exposing recipient lists. @param email Recipient. @param campaign Content. @param url Unsubscribe URL. @return Completion. */
			async send(email, campaign, url) {
				await transport.sendMail({ from, to: email, subject: campaign.subject,
					text: `${campaign.body}\n\nUnsubscribe / Disiscriviti:\n${url}`,
					headers: { 'List-Unsubscribe': `<${url}>` } });
			}
		}
	};
}
