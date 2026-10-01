/**
 * Server hooks: resolves the API session into locals and guards /admin.
 */
import type { Handle } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';
import { apiBase } from './lib/api.js';

/**
 * @brief Session user shape returned by the API.
 */
interface SessionUser {
	id: string;
	email: string;
	name: string;
	role: string;
}

/**
 * @brief Resolves the session cookie against the API.
 * @param cookie The raw Cookie header, if any.
 * @returns The session user or null.
 */
async function resolveSessionUser(cookie: string | null): Promise<SessionUser | null> {
	if (cookie === null) {
		return null;
	}
	try {
		const response = await fetch(`${apiBase()}/api/auth/me`, { headers: { cookie } });
		if (!response.ok) {
			return null;
		}
		const body = (await response.json()) as { user?: SessionUser };
		return body.user ?? null;
	} catch {
		return null;
	}
}

/**
 * @brief SvelteKit handle hook with session locals and admin guard.
 */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = await resolveSessionUser(event.request.headers.get('cookie'));
	if (event.url.pathname === '/admin' || event.url.pathname.startsWith('/admin/')) {
		if (event.locals.user === null) {
			throw redirect(303, '/login');
		}
	}
	return resolve(event);
};
