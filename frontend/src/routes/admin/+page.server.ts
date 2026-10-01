/**
 * Admin dashboard load: every post including drafts for the ledger table.
 */
import { adminListPosts } from '../../lib/server/admin-api.js';
import type { PageServerLoad } from './$types';

/**
 * Loads the admin post ledger.
 * @returns The rows plus API reachability.
 */
export const load: PageServerLoad = async ({ request }) => {
	const rows = await adminListPosts(request.headers.get('cookie'));
	return { items: rows?.items ?? [], total: rows?.total ?? 0, online: rows !== null };
};
