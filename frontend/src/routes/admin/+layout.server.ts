/**
 * @file +layout.server.ts
 * @brief * Admin layout: exposes the session user (hooks.server.ts already guards access).
 */
import type { LayoutServerLoad } from './$types';

/**
 * @brief Loads the session user for every admin page.
 * @returns The session user.
 * @param event The current request event.
 */
export const load: LayoutServerLoad = ({ locals }) => {
	return { user: locals.user };
};
