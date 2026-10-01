/**
 * Tag detail load: published posts for one tag with pagination.
 */
import { z } from 'zod';
import { getPostsByTag } from '../../../lib/api.js';
import type { PageServerLoad } from './$types';

/** Number of records per tag page. */
const PER_PAGE = 10;

/**
 * Loads one page of posts for the tag route parameter.
 * @returns The tag name plus page items and pager state.
 */
export const load: PageServerLoad = async ({ params, url }) => {
	const parsed = z.coerce.number().int().min(1).safeParse(url.searchParams.get('page'));
	const page = parsed.success ? parsed.data : 1;
	const result = await getPostsByTag(params.slug, PER_PAGE, (page - 1) * PER_PAGE);
	const total = result?.total ?? 0;
	return {
		tag: params.slug,
		items: result?.items ?? [],
		total,
		page,
		totalPages: Math.max(1, Math.ceil(total / PER_PAGE)),
		online: result !== null
	};
};
