/**
 * @file admin-pagination.ts
 * @brief Validated administrator pagination and filter-preserving links.
 */
import { z } from 'zod';

const statusSchema = z.enum(['all', 'draft', 'published', 'archived']);
export type AdminStatus = z.infer<typeof statusSchema>;
export const ADMIN_PAGE_SIZE = 25;

/** @brief Reads safe filters and page bounds from a dashboard URL. @param url Request URL. @return Normalized controls. */
export function adminFilters(url: URL) {
	const parsed = z.coerce.number().int().min(1).max(40_001).safeParse(url.searchParams.get('page'));
	return {
		page: parsed.success ? parsed.data : 1,
		search: (url.searchParams.get('search') ?? '').trim().slice(0, 200),
		status: statusSchema.catch('all').parse(url.searchParams.get('status') ?? 'all')
	};
}

/** @brief Preserves search and status while changing dashboard pages. @param search Search text. @param status Selected status. @param page Target page. @return Relative dashboard URL. */
export function adminPageHref(search: string, status: AdminStatus, page = 1): string {
	const query = new URLSearchParams();
	if (search) query.set('search', search);
	if (status !== 'all') query.set('status', status);
	if (page > 1) query.set('page', String(page));
	return `/admin${query.size ? `?${query}` : ''}`;
}
