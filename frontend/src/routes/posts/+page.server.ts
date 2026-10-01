/**
 * Posts index load: paginated published posts (?page=N, 10 per page).
 */
import { z } from 'zod';
import { getPostsPage } from '../../lib/api.js';
import type { PageServerLoad } from './$types';

/** Number of records per index page. */
const PER_PAGE = 10;

/**
 * Loads one page of published posts.
 * @returns The page items, totals and pager state.
 */
export const load: PageServerLoad = async ({ url }) => {
	const parsed = z.coerce.number().int().min(1).safeParse(url.searchParams.get('page'));
	const page = parsed.success ? parsed.data : 1;
	const result = await getPostsPage(PER_PAGE, (page - 1) * PER_PAGE);
	const total = result?.total ?? 0;
	return {
		items: result?.items ?? [],
		total,
		page,
		perPage: PER_PAGE,
		totalPages: Math.max(1, Math.ceil(total / PER_PAGE)),
		online: result !== null
	};
};
