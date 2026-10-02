/**
 * @file auth-cookie.ts
 * @brief Applies only validated API session cookies, preserving frontend HTTPS security.
 */
import type { Cookies } from '@sveltejs/kit';
import { siteBase } from '../site.js';

/**
 * @brief Stores only the API's recognized session token.
 * @param cookies The frontend cookie jar.
 * @param headers Upstream Set-Cookie values.
 * @return Whether a valid session cookie was applied.
 */
export function applySessionCookie(cookies: Cookies, headers: string[]): boolean {
	for (const header of headers) {
		const parts = header.split(';').map((part) => part.trim());
		const pair = parts[0] ?? '';
		if (!/^session=[A-Za-z0-9_-]{43}$/.test(pair)) {
			continue;
		}
		const agePart = parts.find((part) => part.toLowerCase().startsWith('max-age='));
		const age = Number(agePart?.split('=')[1] ?? 2592000);
		if (!Number.isSafeInteger(age) || age <= 0) {
			continue;
		}
		cookies.set('session', pair.slice('session='.length), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure:
				siteBase().startsWith('https:') || parts.some((part) => part.toLowerCase() === 'secure'),
			maxAge: Math.min(age, 2592000)
		});
		return true;
	}
	return false;
}
