/**
 * @file +page.server.ts
 * @brief * Admin tags load: tag catalog with published-post counts.
 */
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import {
	adminDeleteTag,
	adminListTags,
	adminUpdateTagColor
} from '../../../lib/server/admin-api.js';
import type { Actions, PageServerLoad } from './$types';

/**
 * @brief Loads the tag catalog for the admin view.
 * @param event Request carrying the administrator session.
 * @return The tag items (empty when the API is offline).
 */
export const load: PageServerLoad = async ({ request, url }) => {
	const result = await adminListTags(request.headers.get('cookie'));
	return {
		items: result?.items ?? [],
		online: result !== null,
		notice: url.searchParams.has('deleted')
			? 'Tag deleted from every post.'
			: url.searchParams.has('updated')
				? 'Tag color updated.'
				: null
	};
};

const idSchema = z.uuid();
const colorSchema = z
	.string()
	.regex(/^#[0-9A-Fa-f]{6}$/)
	.transform((value) => value.toUpperCase());

export const actions: Actions = {
	/** @brief Updates one tag color. @param event Form request. @return Failure or redirect. */
	color: async ({ request }) => {
		const form = await request.formData();
		const id = idSchema.safeParse(form.get('id'));
		const color = colorSchema.safeParse(form.get('color'));
		if (!id.success || !color.success) {
			return fail(400, { error: 'Choose a valid tag color.' });
		}
		const result = await adminUpdateTagColor(request.headers.get('cookie'), id.data, color.data);
		if (!result.ok) {
			return fail(400, { error: result.error });
		}
		throw redirect(303, '/admin/tags?updated=1');
	},
	/** @brief Deletes one tag and all associations. @param event Form request. @return Failure or redirect. */
	delete: async ({ request }) => {
		const form = await request.formData();
		const id = idSchema.safeParse(form.get('id'));
		if (!id.success) {
			return fail(400, { error: 'Invalid tag.' });
		}
		const result = await adminDeleteTag(request.headers.get('cookie'), id.data);
		if (!result.ok) {
			return fail(400, { error: result.error });
		}
		throw redirect(303, '/admin/tags?deleted=1');
	}
};
