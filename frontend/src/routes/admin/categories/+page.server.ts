/**
 * @file +page.server.ts
 * @brief Administrator category assignment listing, rename and clearing.
 */
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { getCategories, replaceCategory } from '../../../lib/server/category-api.js';
import { serverT } from '../../../lib/server/server-t.js';
import type { Actions, PageServerLoad } from './$types';

/** @brief Loads categories including drafts. @param event Admin request. @return Counts. */
export const load: PageServerLoad = async ({ request }) => {
	const items = await getCategories(request.headers.get('cookie'), true);
	return { items: items ?? [], online: items !== null };
};

export const actions: Actions = {
	/** @brief Renames or clears assignments after explicit form confirmation. @param event Admin form. @return Failure or redirect. */
	default: async ({ request }) => {
		const form = await request.formData();
		const parsed = z.object({ name: z.string().trim().min(1).max(80),
			replacement: z.string().trim().max(80), confirm: z.literal('yes') }).safeParse(Object.fromEntries(form));
		if (!parsed.success) { return fail(400, { error: serverT('publishing.failed') }); }
		if (!await replaceCategory(request.headers.get('cookie'), parsed.data.name, parsed.data.replacement || null)) {
			return fail(502, { error: serverT('publishing.failed') });
		}
		throw redirect(303, '/admin/categories');
	}
};
