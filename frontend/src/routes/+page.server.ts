/**
 * @file +page.server.ts
 * @brief * Homepage server load: recent published posts plus static sheet data.
 * The API may be offline; the page renders an offline stamp instead of failing.
 */
import { getRecentPosts } from '../lib/api.js';
import { getHomepageData } from '../lib/index.js';
import type { PageServerLoad } from './$types';

/**
 * @brief Loads homepage data with the newest published posts.
 * @returns Sheet data plus the recent-posts page (or null when offline).
 */
export const load: PageServerLoad = async ({ request }) => {
	return { ...getHomepageData(), posts: await getRecentPosts(5, request.headers.get('cookie')) };
};
