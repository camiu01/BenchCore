/**
 * @file +server.ts
 * @brief * Logout endpoint: destroys the API session, clears the cookie, redirects home.
 */
import { mutationOrigin } from '../../lib/site.js';
import { apiBase } from '../../lib/api.js';
import { apiFetch } from '../../lib/server/transport.js';
import type { RequestHandler } from './$types';

/**
 * @brief Handles logout POSTs.
 * @param event The current request event.
 * @return The result, or a redirect for completed mutations.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const cookie = request.headers.get('cookie');
	try {
		await apiFetch(`${apiBase()}/api/auth/logout`, {
			method: 'POST',
			headers:
				cookie === null ? { origin: mutationOrigin() } : { cookie, origin: mutationOrigin() },
			signal: AbortSignal.timeout(10000)
		});
	} catch {
		// API offline: still clear the local cookie below.
	}
	cookies.delete('session', { path: '/' });
	return new Response(null, {
		status: 303,
		headers: {
			location: '/'
		}
	});
};
