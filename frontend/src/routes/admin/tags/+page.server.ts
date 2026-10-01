/**
 * Admin tags load: tag catalog with published-post counts.
 */
import { getTags } from '../../../lib/api.js';
import type { PageServerLoad } from './$types';

/**
 * Loads the tag catalog for the admin view.
 * @returns The tag items (empty when the API is offline).
 */
export const load: PageServerLoad = async () => {
	const result = await getTags();
	return { items: result?.items ?? [], online: result !== null };
};
