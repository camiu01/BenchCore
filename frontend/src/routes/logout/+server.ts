/**
 * Logout endpoint: destroys the API session, clears the cookie, redirects home.
 */
import { apiBase } from '../../lib/api.js';
import type { RequestHandler } from './$types';

/**
 * @brief Handles logout POSTs.
 */
export const POST: RequestHandler = async ({ request }) => {
	const cookie = request.headers.get('cookie');
	try {
		await fetch(`${apiBase()}/api/auth/logout`, {
			method: 'POST',
			headers: cookie === null ? {} : { cookie }
		});
	} catch {
		// API offline: still clear the local cookie below.
	}
	return new Response(null, {
		status: 303,
		headers: {
			location: '/',
			'set-cookie': 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
		}
	});
};
