/**
 * @file hooks.server.ts
 * @brief Resolves validated sessions, guards admin access and hardens frontend responses.
 */
import type { Handle } from '@sveltejs/kit/hooks';
import { isRedirect } from '@sveltejs/kit';
import { resolveSessionUser } from './lib/server/session.js';
import { secureResponse } from './lib/server/security.js';
import { LOCALE_COOKIE, resolveLocale } from './lib/i18n/locale.js';
import { runWithLocale } from './lib/server/request-locale.js';

/**
 * @brief Guards private routes and same-origin mutations before resolving a request.
 * @param input The SvelteKit event and response resolver.
 * @return A secured page, redirect, or rejected mutation response.
 */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.locale = resolveLocale(
		event.cookies.get(LOCALE_COOKIE),
		event.request.headers.get('accept-language')
	);
	return runWithLocale(event.locals.locale, () => handlePage({ event, resolve }));
};

/**
 * @brief Resolves a page and stamps the negotiated language on the document element.
 * @param event Request event carrying the locale.
 * @param resolve SvelteKit resolver.
 * @return The rendered response.
 */
function resolveWithLanguage(
	event: Parameters<Handle>[0]['event'],
	resolve: Parameters<Handle>[0]['resolve']
): Promise<Response> {
	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('<html lang="en"', `<html lang="${event.locals.locale}"`)
	});
}
/**
 * @brief Applies existing page authentication and nonce-backed response security.
 * @param input Request event and resolver.
 * @return Guarded page response.
 */
const handlePage: Handle = async ({ event, resolve }) => {
	const method = event.request.method;
	if (
		!['GET', 'HEAD', 'OPTIONS'].includes(method) &&
		event.request.headers.get('origin') !== event.url.origin
	) {
		return secureResponse(new Response('Forbidden origin', { status: 403 }), event);
	}
	event.locals.user = await resolveSessionUser(event.request.headers.get('cookie'));
	if (
		(event.url.pathname === '/account' ||
			event.url.pathname === '/admin' ||
			event.url.pathname.startsWith('/admin/')) &&
		event.locals.user === null
	) {
		return secureResponse(
			new Response(null, {
				status: 303,
				headers: { location: '/login' }
			}),
			event
		);
	}
	if (
		(event.url.pathname === '/admin' || event.url.pathname.startsWith('/admin/')) &&
		event.locals.user?.role !== 'admin'
	) {
		return secureResponse(new Response('Administrator access required', { status: 403 }), event);
	}
	try {
		return secureResponse(await resolveWithLanguage(event, resolve), event);
	} catch (cause) {
		if (!isRedirect(cause)) {
			throw cause;
		}
		return secureResponse(
			new Response(null, {
				status: cause.status,
				headers: { location: cause.location }
			}),
			event
		);
	}
};
