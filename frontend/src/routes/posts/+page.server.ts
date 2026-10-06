/**
 * @file +page.server.ts
 * @brief * Posts index load: paginated published posts (?page=N, 10 per page).
 */
import { getPostsPage, getTags } from '../../lib/api.js';
import { archiveQuery } from '../../lib/posts-query.js';
import type { PageServerLoad } from './$types';

/** Number of records per index page. */
const PER_PAGE = 10;

/**
 * @brief Loads one page of published posts.
 * @returns The page items, totals and pager state.
 * @param event The current request event.
 */
export const load: PageServerLoad = async ({ url, request }) => {
	const query = archiveQuery(url.searchParams);
	const [result, tags] = await Promise.all([
		getPostsPage(
			PER_PAGE,
			(query.page - 1) * PER_PAGE,
			query.search,
			request.headers.get('cookie'),
			query
		),
		getTags()
	]);
	const total = result?.total ?? 0;
	return {
		items: result?.items ?? [],
		total,
		...query,
		availableTags: tags?.items ?? [],
		perPage: PER_PAGE,
		totalPages: Math.max(1, Math.ceil(total / PER_PAGE)),
		online: result !== null
	};
};
