/**
 * @file +page.server.ts
 * @brief Protected, server-filtered administrator post pagination.
 */
import { adminListPosts } from '../../lib/server/admin-api.js';
import type { PageServerLoad } from './$types';
import { adminFilters, ADMIN_PAGE_SIZE } from '../../lib/admin-pagination.js';

/**
 * @brief Loads the admin post ledger.
 * @returns The rows plus API reachability.
 * @param event The current request event.
 */
export const load: PageServerLoad = async ({ request, url }) => {
	const filters = adminFilters(url);
	const query = new URLSearchParams({
		limit: String(ADMIN_PAGE_SIZE),
		offset: String((filters.page - 1) * ADMIN_PAGE_SIZE),
		search: filters.search
	});
	if (filters.status !== 'all') query.set('status', filters.status);
	const rows = await adminListPosts(request.headers.get('cookie'), query);
	return {
		...filters,
		perPage: ADMIN_PAGE_SIZE,
		totalPages: Math.max(1, Math.ceil((rows?.total ?? 0) / ADMIN_PAGE_SIZE)),
		items: rows?.items ?? [],
		total: rows?.total ?? 0,
		online: rows !== null,
		counts: rows?.counts ?? { all: 0, draft: 0, published: 0, archived: 0 }
	};
};
