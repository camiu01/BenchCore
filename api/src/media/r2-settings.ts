/**
 * @file r2-settings.ts
 * @brief Strict private R2 configuration and short-lived owner-bound upload tickets.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { mediaRecord } from './storage.js';

export interface R2Settings {
	accountId: string; bucket: string; accessKeyId: string; secretAccessKey: string; uploadSecret: string;
}
const settingsSchema = z.object({
	accountId: z.string().regex(/^[a-f0-9]{32}$/),
	bucket: z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/),
	accessKeyId: z.string().min(16), secretAccessKey: z.string().min(32), uploadSecret: z.string().min(32)
});
const ticketSchema = z.object({ record: mediaRecord, owner: z.string().uuid(), expires: z.number().int() });

/**
 * @brief Reads only private server credentials and rejects malformed endpoints.
 * @param env Runtime environment.
 * @return Validated R2 settings.
 */
export function r2Settings(env: NodeJS.ProcessEnv): R2Settings {
	return settingsSchema.parse({ accountId: env['R2_ACCOUNT_ID'], bucket: env['R2_BUCKET'],
		accessKeyId: env['R2_ACCESS_KEY_ID'], secretAccessKey: env['R2_SECRET_ACCESS_KEY'],
		uploadSecret: env['R2_UPLOAD_SECRET'] });
}

/**
 * @brief Signs a short-lived ticket bound to immutable object metadata and its owner.
 * @param value Validated ticket data.
 * @param secret Private signing key.
 * @return Opaque bounded ticket.
 */
export function signUploadTicket(value: z.infer<typeof ticketSchema>, secret: string): string {
	const body = Buffer.from(JSON.stringify(ticketSchema.parse(value))).toString('base64url');
	return `${body}.${createHmac('sha256', secret).update(body).digest('hex')}`;
}

/**
 * @brief Verifies the signature before decoding and checks owner and expiry.
 * @param ticket Untrusted ticket.
 * @param owner Current authenticated administrator.
 * @param secret Private signing key.
 * @param now Current clock in milliseconds.
 * @return Validated object metadata.
 */
export function verifyUploadTicket(ticket: string, owner: string, secret: string, now = Date.now()) {
	if (ticket.length > 4096) { throw new Error('Invalid upload ticket'); }
	const [body, signature, extra] = ticket.split('.');
	if (!body || !signature || extra !== undefined || !/^[a-f0-9]{64}$/.test(signature)) {
		throw new Error('Invalid upload ticket');
	}
	const expected = createHmac('sha256', secret).update(body).digest();
	if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) { throw new Error('Invalid upload ticket'); }
	const value = ticketSchema.parse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')));
	if (value.owner !== owner || value.expires <= now) { throw new Error('Expired or foreign upload ticket'); }
	return value.record;
}
