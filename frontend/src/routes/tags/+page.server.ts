/**
 * @file +page.server.ts
 * @brief * Tags index load: every tag with published-post counts.
 */
import { getTags } from '../../lib/api.js';
import type { PageServerLoad } from './$types';

/**
 * @brief Loads the tag catalog.
 * @returns The tag items (empty when the API is offline).
 */
export const load: PageServerLoad = async () => {
	const result = await getTags();
	return { items: result?.items ?? [], online: result !== null };
};
