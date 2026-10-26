/**
 * @file configured-services.test.ts
 * @brief Shared entrypoint wiring remains lazy and optional delivery never sends at construction.
 */
import { readFile } from 'node:fs/promises';
import { afterAll, describe, expect, it, vi } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { configuredServices } from '../src/configured-services.js';
import * as schema from '../src/db/schema.js';

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }));
const sql = postgres('postgresql://unused:unused@127.0.0.1:1/not_connected_test', { max: 1 });
const db = drizzle(sql, { schema });
afterAll(async () => {
	await sql.end({ timeout: 1 });
});

describe('shared runtime dependencies', () => {
	it('provides newsletter persistence but disables unconfigured optional delivery', () => {
		const services = configuredServices(db, {});
		expect(services.newsletter.repository).toBeDefined();
		expect(services.newsletter.mail).toBeUndefined();
		expect(services.passwordReset).toBeUndefined();
		expect(services.totpKey).toBeUndefined();
		expect(services.media.restore).toBeDefined();
		expect(sendMail).not.toHaveBeenCalled();
	});

	it('wires explicitly enabled mail and R2 without querying SQL, sending mail or uploading', () => {
		const services = configuredServices(db, {
			MEDIA_STORAGE: 'r2',
			SITE_URL: 'https://site.example.invalid',
			NEWSLETTER_ENABLED: 'true',
			ZOHO_SMTP_USER: 'operator@example.invalid',
			ZOHO_SMTP_PASSWORD: 'fixture-only-password',
			NEWSLETTER_TOKEN_KEY: 'fixture-newsletter-key-'.repeat(3),
			R2_ACCOUNT_ID: 'a'.repeat(32),
			R2_BUCKET: 'fixture-media',
			R2_ACCESS_KEY_ID: 'fixture-access-key-only',
			R2_SECRET_ACCESS_KEY: 'fixture-secret-'.repeat(4),
			R2_UPLOAD_SECRET: 'fixture-upload-'.repeat(4)
		});
		expect(services.passwordReset?.siteUrl).toBe('https://site.example.invalid');
		expect(services.newsletter.mail?.siteUrl).toBe('https://site.example.invalid');
		expect(services.media.direct).toBeDefined();
		expect(sendMail).not.toHaveBeenCalled();
	});

	it('all production entrypoints use the same service constructor', async () => {
		for (const path of [
			'../src/index.ts',
			'../src/serverless/app.ts',
			'../../runtime/server.mjs'
		]) {
			const source = await readFile(new URL(path, import.meta.url), 'utf8');
			expect(source).toMatch(/configuredServices\(db, (process\.env|env)\)/);
		}
	});

	it('rejects partial email settings and missing R2 configuration before serving', () => {
		expect(() => configuredServices(db, { ZOHO_SMTP_USER: 'operator@example.invalid' })).toThrow();
		expect(() => configuredServices(db, { MEDIA_STORAGE: 'r2' })).toThrow();
		expect(sendMail).not.toHaveBeenCalled();
	});
});
