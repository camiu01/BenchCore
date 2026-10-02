/**
 * @file +page.server.ts
 * @brief * Admin tags load: tag catalog with published-post counts.
 */
import { adminListTags } from '../../../lib/server/admin-api.js';
import type { PageServerLoad } from './$types';

/**
 * @brief Loads the tag catalog for the admin view.
 * @param event Request carrying the administrator session.
 * @return The tag items (empty when the API is offline).
 */
export const load: PageServerLoad = async ({ request }) => {
	const result = await adminListTags(request.headers.get('cookie'));
	return { items: result?.items ?? [], online: result !== null };
};
