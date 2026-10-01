/**
 * @file session.ts
 * @brief Session tokens, SHA-256 at-rest hashing, and cookie helpers.
 */
import { createHash, randomBytes } from 'node:crypto';

/** Session cookie name. */
export const SESSION_COOKIE = 'session';

/** Session lifetime: 30 days in milliseconds. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * @brief Hashes a session token for database storage.
 * @param token The raw token presented in the cookie.
 * @return The hex SHA-256 digest.
 */
export function hashToken(token: string): string {
	return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * @brief Creates a fresh session token and its storage hash.
 * @return The cookie token plus the hash to persist.
 */
export function createSessionToken(): { token: string; tokenHash: string } {
	const token = randomBytes(32).toString('base64url');
	return { token, tokenHash: hashToken(token) };
}

/**
 * @brief Builds the expiry date for a new session.
 * @param now The reference time.
 * @return The expiry date.
 */
export function buildSessionExpiry(now: Date = new Date()): Date {
	return new Date(now.getTime() + SESSION_TTL_MS);
}

/**
 * @brief Builds a Set-Cookie header value for the session token.
 * @param token The raw session token.
 * @param secure Whether to add the Secure flag (production HTTPS).
 * @return The header value.
 */
export function sessionCookieHeader(token: string, secure: boolean): string {
	const parts = [
		`${SESSION_COOKIE}=${token}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Lax',
		`Max-Age=${SESSION_TTL_MS / 1000}`
	];
	if (secure) {
		parts.push('Secure');
	}
	return parts.join('; ');
}

/**
 * @brief Builds a Set-Cookie header value clearing the session.
 * @return The header value.
 */
export function clearSessionCookieHeader(): string {
	return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/**
 * @brief Parses a Cookie header into a name/value map.
 * @param header The raw Cookie header value, if any.
 * @return The parsed cookies.
 */
export function parseCookies(header: string | undefined): Record<string, string> {
	const cookies: Record<string, string> = {};
	if (header === undefined || header === '') {
		return cookies;
	}
	for (const pair of header.split(';')) {
		const separator = pair.indexOf('=');
		if (separator === -1) {
			continue;
		}
		const name = pair.slice(0, separator).trim();
		const value = pair.slice(separator + 1).trim();
		if (name !== '') {
			cookies[name] = decodeURIComponent(value);
		}
	}
	return cookies;
}
