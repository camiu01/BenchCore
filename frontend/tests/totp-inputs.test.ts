/**
 * @file totp-inputs.test.ts
 * @brief Literal browser pattern regression for enrollment, removal and optional TOTP login codes.
 */
import type { ComponentProps } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import SecurityPage from '../src/routes/account/security/+page.svelte';
import LoginPage from '../src/routes/login/+page.svelte';

const data: ComponentProps<typeof SecurityPage>['data'] = {
	locale: 'en',
	siteBase: 'https://example.test',
	sessionRole: 'admin',
	directUploads: false,
	schedulerEnabled: false,
	user: {
		id: '00000000-0000-4000-8000-000000000001',
		name: 'Operator',
		email: 'operator@example.test',
		role: 'admin'
	},
	factor: { enabled: false, available: true }
};

/**
 * @brief Reads the compiled HTML pattern rather than trusting the Svelte source attribute.
 * @param body Server-rendered page.
 * @return Anchored six-digit matcher.
 */
function compiledCodePattern(body: string): RegExp {
	const input = body.match(/<input\b[^>]*\bname="code"[^>]*>/)?.[0] ?? '';
	const pattern = input.match(/\bpattern="([^"]+)"/)?.[1];
	expect(pattern).toBe('[0-9]{6}');
	expect(input).toContain('inputmode="numeric"');
	expect(input).toContain('autocomplete="one-time-code"');
	expect(input).toContain('minlength="6"');
	expect(input).toContain('maxlength="6"');
	return new RegExp(`^(?:${pattern})$`, 'v');
}

describe('browser authenticator fields', () => {
	it.each(['enroll', 'disable', 'login'] as const)(
		'preserves the regex quantifier in the %s form',
		(mode) => {
			const enrollment = {
				secret: 'A'.repeat(32),
				ticket: 'fixture-ticket',
				qr: { size: 29, path: 'M4 4h1v1h-1z' }
			};
			const result =
				mode === 'login'
					? render(LoginPage, {
							props: { data: { ...data, notice: null, next: null }, form: null }
						})
					: render(SecurityPage, {
							props: {
								data: { ...data, factor: { enabled: mode === 'disable', available: true } },
								form: mode === 'enroll' ? { enrollment } : null
							}
						});
			const pattern = compiledCodePattern(result.body);
			for (const code of ['123456', '001234', '000000', '999999']) {
				expect(pattern.test(code), code).toBe(true);
			}
			for (const code of ['', '16', '12345', '1234567', 'abcdef', '123 456']) {
				expect(pattern.test(code), code).toBe(false);
			}
			const input = result.body.match(/<input\b[^>]*\bname="code"[^>]*>/)?.[0] ?? '';
			expect(input.includes(' required')).toBe(mode !== 'login');
		}
	);
});
