/**
 * @file session.test.ts
 * @brief Unit tests for session tokens and cookie helpers.
 */
import { describe, expect, it } from 'vitest';
import {
	buildSessionExpiry,
	clearSessionCookieHeader,
	createSessionToken,
	hashToken,
	parseCookies,
	SESSION_COOKIE,
	SESSION_TTL_MS,
	sessionCookieHeader
} from '../src/auth/session.js';

describe('session tokens', () => {
	it('creates unique tokens with stable hashes', () => {
		const first = createSessionToken();
		const second = createSessionToken();
		expect(first.token).not.toBe(second.token);
		expect(hashToken(first.token)).toBe(first.tokenHash);
	});

	it('builds a 30-day expiry', () => {
		const now = new Date('2026-01-01T00:00:00Z');
		expect(buildSessionExpiry(now).getTime() - now.getTime()).toBe(SESSION_TTL_MS);
	});

	it('builds secure cookie headers', () => {
		const header = sessionCookieHeader('abc', true);
		expect(header).toContain(`${SESSION_COOKIE}=abc`);
		expect(header).toContain('HttpOnly');
		expect(header).toContain('SameSite=Lax');
		expect(header).toContain('Secure');
		expect(sessionCookieHeader('abc', false)).not.toContain('Secure');
		expect(clearSessionCookieHeader()).toContain('Max-Age=0');
	});

	it('parses cookie headers', () => {
		expect(parseCookies('session=abc; other=1')).toEqual({ session: 'abc', other: '1' });
		expect(parseCookies(undefined)).toEqual({});
		expect(parseCookies('')).toEqual({});
	});
});
