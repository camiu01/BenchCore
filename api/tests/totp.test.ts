/**
 * @file totp.test.ts
 * @brief RFC vectors, enrollment binding, expiry and authenticated factor encryption regressions.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { base32Secret, configuredTotpKey, createEnrollment, enrollmentSecret, openFactor,
	sealFactor, totpCode, verifiedTotpStep } from '../src/auth/totp.js';

const key = 'a1'.repeat(32);
const secret = Buffer.from('12345678901234567890').toString('hex');
afterEach(() => { vi.restoreAllMocks(); });

describe('administrator TOTP primitives', () => {
	it.each([
		[59, '287082'], [1111111109, '081804'], [1111111111, '050471'],
		[1234567890, '005924'], [2000000000, '279037'], [20000000000, '353130']
	])('matches RFC 6238 SHA-1 at %s seconds', (time, expected) => {
		expect(totpCode(secret, Math.floor(Number(time) / 30))).toBe(expected);
	});
	it('accepts only six digits within one time step of skew', () => {
		const now = 1_800_000_000_000;
		const step = Math.floor(now / 30_000);
		for (const skew of [-1, 0, 1]) {
			expect(verifiedTotpStep(secret, totpCode(secret, step + skew), now)).toBe(step + skew);
		}
		expect(verifiedTotpStep(secret, totpCode(secret, step - 2), now)).toBeNull();
		for (const input of ['12345', '1234567', 'abcdef', '１２３４５６']) {
			expect(verifiedTotpStep(secret, input, now)).toBeNull();
		}
	});
	it('uses authenticator-compatible base32 and rejects invalid configuration', () => {
		expect(base32Secret(Buffer.from('12345678901234567890'))).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
		expect(configuredTotpKey({})).toBeUndefined();
		expect(configuredTotpKey({ AUTH_TOTP_KEY: key })).toBe(key);
		for (const input of ['', 'not-a-key', 'ab'.repeat(31)]) {
			expect(() => configuredTotpKey({ AUTH_TOTP_KEY: input })).toThrow('64 hexadecimal');
		}
	});
	it('binds encrypted material to its owner and purpose, detecting tampering and key loss', () => {
		const sealed = sealFactor(secret, key, 'totp:owner');
		expect(sealed).not.toContain(secret);
		expect(openFactor(sealed, key, 'totp:owner')).toBe(secret);
		for (const [candidate, candidateKey, context] of [
			[sealed, key, 'totp:other'], [sealed, key, 'enrollment:owner'],
			[sealed, 'b2'.repeat(32), 'totp:owner'], [sealed.slice(1), key, 'totp:owner']
		]) { expect(openFactor(candidate!, candidateKey!, context!)).toBeNull(); }
	});
	it('expires enrollment after ten minutes and rejects stale epochs and other owners', () => {
		const clock = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
		const enrollment = createEnrollment('owner', 3, key);
		expect(enrollment.secret).toMatch(/^[A-Z2-7]{32}$/);
		expect(enrollmentSecret(enrollment.ticket, 'owner', 3, key)).toMatch(/^[a-f0-9]{40}$/);
		expect(enrollmentSecret(enrollment.ticket, 'other', 3, key)).toBeNull();
		expect(enrollmentSecret(enrollment.ticket, 'owner', 4, key)).toBeNull();
		clock.mockReturnValue(1_800_000_600_000);
		expect(enrollmentSecret(enrollment.ticket, 'owner', 3, key)).toBeNull();
	});
});
