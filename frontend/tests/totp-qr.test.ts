/**
 * @file totp-qr.test.ts
 * @brief Independently decodes QR SVG geometry and checks enrollment isolation, compatibility and accessible rendering.
 */
import jsQR from 'jsqr';
import { render } from 'svelte/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTotpQr } from '../src/lib/server/totp-qr.js';
import type { TotpQrGraphic } from '../src/lib/server/totp-qr.js';
import { enrollmentSchema } from '../src/lib/server/security-api.js';
import AuthenticatorQr from '../src/lib/components/AuthenticatorQr.svelte';
import SecurityPage from '../src/routes/account/security/+page.svelte';
import { actions } from '../src/routes/account/security/+page.server.js';
import { setTestLocale } from './support/locale.js';

const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const uri = `otpauth://totp/BenchCore%3Aoperator%40example.test?secret=${secret}&issuer=BenchCore&algorithm=SHA1&digits=6&period=30`;
const enrollment = { secret, ticket: 'fixture-ticket', uri };
const user = {
	id: '00000000-0000-4000-8000-000000000001',
	name: 'Operator',
	email: 'operator@example.test',
	role: 'admin'
};

afterEach(() => {
	setTestLocale('en');
	vi.unstubAllGlobals();
});

/**
 * @brief Paints the emitted path runs into a pixel buffer using no encoder internals.
 * @param qr Serializable SVG geometry.
 * @param scale Pixels per QR module.
 * @return RGBA raster suitable for an independent scanner.
 */
function rasterize(qr: TotpQrGraphic, scale: number): Uint8ClampedArray {
	const width = qr.size * scale;
	const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
	for (const run of qr.path.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)) {
		const x = Number(run[1]);
		const y = Number(run[2]);
		const length = Number(run[3]);
		expect(Number(run[4])).toBe(length);
		expect(x).toBeGreaterThanOrEqual(4);
		expect(y).toBeGreaterThanOrEqual(4);
		expect(x + length).toBeLessThanOrEqual(qr.size - 4);
		expect(y + 1).toBeLessThanOrEqual(qr.size - 4);
		for (let row = y * scale; row < (y + 1) * scale; row++) {
			for (let column = x * scale; column < (x + length) * scale; column++) {
				const offset = (row * width + column) * 4;
				pixels[offset] = 0;
				pixels[offset + 1] = 0;
				pixels[offset + 2] = 0;
			}
		}
	}
	return pixels;
}

describe('authenticator QR', () => {
	it.each([
		uri,
		uri.replace('operator%40example.test', 'operator%2Blab%40example.test'),
		uri.replace('operator%40example.test', `${'reader'.repeat(40)}%40example.test`)
	])('encodes an independently readable TOTP URI', (payload) => {
		const qr = createTotpQr(payload);
		const width = qr.size * 6;
		const decoded = jsQR(rasterize(qr, 6), width, width, { inversionAttempts: 'dontInvert' });
		expect(decoded?.data).toBe(payload);
		const scanned = new URL(decoded?.data ?? 'https://invalid.example.test');
		expect(scanned.protocol).toBe('otpauth:');
		expect(scanned.searchParams.get('secret')).toBe(secret);
		expect(scanned.searchParams.get('issuer')).toBe('BenchCore');
		expect(scanned.searchParams.get('algorithm')).toBe('SHA1');
		expect(scanned.searchParams.get('digits')).toBe('6');
		expect(scanned.searchParams.get('period')).toBe('30');
		expect(qr.path).toMatch(/^(?:M\d+ \d+h\d+v1h-\d+z)+$/);
	});

	it('bounds encoder input', () => {
		expect(() => createTotpQr('x'.repeat(1025))).toThrow('QR limit');
	});

	it.each(['en', 'it'] as const)(
		'renders a labelled, theme-independent QR in %s without external resources',
		(locale) => {
			setTestLocale(locale);
			const result = render(AuthenticatorQr, { props: { qr: createTotpQr(uri) } });
			expect(result.body).toContain('role="img"');
			expect(result.body).toContain(
				locale === 'it' ? 'Codice QR per configurare' : 'QR code for authenticator setup'
			);
			expect(result.body).toContain('fill="#ffffff"');
			expect(result.body).toContain('fill="#000000"');
			expect(result.body).toContain('shape-rendering="crispEdges"');
			expect(result.body).not.toContain('<img');
			expect(result.body).not.toContain('<image');
			expect(result.body).not.toContain('<foreignObject');
			expect(result.body).not.toContain('href=');
			expect(result.body).not.toContain('otpauth:');
			expect(result.body).not.toContain('fixture-ticket');
		}
	);

	it('shows QR and manual entry only after a confirmed enrollment response', () => {
		const data = {
			siteBase: 'https://site.example.test',
			locale: 'en' as const,
			sessionRole: 'admin',
			directUploads: false,
			schedulerEnabled: false,
			user,
			factor: { enabled: false, available: true }
		};
		const before = render(SecurityPage, { props: { data, form: null } });
		expect(before.body).not.toContain('role="img"');
		const after = render(SecurityPage, {
			props: {
				data,
				form: { enrollment: { secret, ticket: 'fixture-ticket', qr: createTotpQr(uri) } }
			}
		});
		expect(after.body).toContain('role="img"');
		expect(after.body).toContain('id="setup-key"');
		expect(after.body).toContain(`value="${secret}"`);
		expect(after.body).toContain('action="?/enable"');
		expect(after.body).not.toContain('<img');
	});
});

describe('authenticator URI validation', () => {
	it('accepts only compatible settings that match the manual key', () => {
		expect(enrollmentSchema.safeParse(enrollment).success).toBe(true);
	});

	it.each([
		uri.replace('otpauth:', 'https:'),
		uri.replace('//totp/', '//example.test/'),
		uri.replace('/BenchCore%3A', '/Other%3A'),
		uri.replace(secret, 'A'.repeat(32)),
		uri.replace('SHA1', 'SHA256'),
		uri.replace('digits=6', 'digits=8'),
		uri.replace('period=30', 'period=60'),
		uri.replace('issuer=BenchCore', 'issuer=Other'),
		`${uri}&secret=${secret}`,
		`${uri}#fragment`,
		'not a URI',
		'x'.repeat(1025)
	])('rejects incompatible or untrusted QR destinations', (payload) => {
		expect(enrollmentSchema.safeParse({ ...enrollment, uri: payload }).success).toBe(false);
	});

	it('does not expose a QR or upstream data when the enrollment URI is invalid', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				Response.json({
					...enrollment,
					uri: 'https://external.example.test/private-secret',
					password: 'private-password'
				})
			)
		);
		const form = new FormData();
		form.set('password', 'private-password');
		const result = await actions.enroll!({
			locals: { user },
			request: new Request('http://localhost:5173/account/security', { method: 'POST', body: form })
		} as unknown as Parameters<NonNullable<typeof actions.enroll>>[0]);
		expect(result).toMatchObject({ status: 502 });
		expect(JSON.stringify(result)).not.toContain('private');
		expect(JSON.stringify(result)).not.toContain('qr');
		expect(JSON.stringify(result)).not.toContain('otpauth:');
	});
});
