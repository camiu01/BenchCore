/**
 * @file security.ts
 * @brief Shared security and cache headers for frontend responses.
 */
import type { RequestEvent } from '@sveltejs/kit';

/**
 * @brief Applies security headers without replacing SvelteKit's generated CSP.
 * @param response The resolved response.
 * @param event The request URL and method.
 * @return The hardened response.
 */
export function secureResponse(
	response: Response,
	event: Pick<RequestEvent, 'url' | 'request'>
): Response {
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('x-frame-options', 'DENY');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
	const path = event.url.pathname;
	if (path === '/' || /^\/(?:posts|tags|graph)(?:\/|$)/.test(path)) {
		response.headers.set('cache-control', 'private, no-store');
		const vary = response.headers.get('vary');
		response.headers.set('vary', vary ? `${vary}, Cookie` : 'Cookie');
	}
	if (
		path === '/admin' ||
		path.startsWith('/admin/') ||
		path === '/login' ||
		path === '/logout' ||
		path === '/account' ||
		path === '/register' ||
		event.request.method !== 'GET'
	) {
		response.headers.set('cache-control', 'no-store');
		response.headers.set('x-robots-tag', 'noindex, nofollow');
	}
	if (event.url.protocol === 'https:') {
		response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
	}
	return response;
}
