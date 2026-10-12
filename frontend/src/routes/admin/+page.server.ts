/**
 * @file +page.server.ts
 * @brief Protected, server-filtered administrator post pagination.
 */
import { adminListPosts } from '../../lib/server/admin-api.js';
import type { PageServerLoad } from './$types';
import { adminFilters, ADMIN_PAGE_SIZE } from '../../lib/admin-pagination.js';
import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { accountError, accountRequest } from '../../lib/server/account-api.js';
import type { Actions } from './$types';

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

export const actions: Actions = {
	/** @brief Deletes only a confirmed bounded selection. @param event Session and form. @return Safe feedback. */
	deleteSelected: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: accountError(403) });
		}
		const form = await request.formData();
		const parsed = z
			.object({ ids: z.array(z.uuid()).min(1).max(100), confirmation: z.literal('DELETE') })
			.safeParse({ ids: form.getAll('ids'), confirmation: form.get('confirmation') });
		if (!parsed.success) {
			return fail(400, { error: accountError(400) });
		}
		const result = await accountRequest(
			request.headers.get('cookie'),
			'/api/admin/posts/delete',
			'POST',
			parsed.data
		);
		const count = z.object({ count: z.number().int().min(0).max(100) }).safeParse(result.data);
		if (result.status !== 200 || !count.success) {
			return fail(result.status === 200 ? 502 : result.status, {
				error: accountError(result.status)
			});
		}
		return { deleted: count.data.count };
	}
};
