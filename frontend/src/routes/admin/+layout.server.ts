/**
 * Admin layout: exposes the session user (hooks.server.ts already guards access).
 */
import type { LayoutServerLoad } from './$types';

/**
 * Loads the session user for every admin page.
 * @returns The session user.
 */
export const load: LayoutServerLoad = ({ locals }) => {
	return { user: locals.user };
};
