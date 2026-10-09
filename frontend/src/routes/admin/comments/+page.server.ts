/**
 * @file +page.server.ts
 * @brief Administrator comment moderation queue.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import {
	adminDeleteComment,
	adminListComments,
	adminModerateComment,
	commentStatusSchema
} from '../../../lib/server/admin-api.js';
import { serverT } from '../../../lib/server/server-t.js';
import type { Actions, PageServerLoad } from './$types';

/** @brief Loads a filtered moderation queue. @param event Request. @return Queue data. */
export const load: PageServerLoad = async ({ request, url }) => {
	const parsed = commentStatusSchema.safeParse(url.searchParams.get('status') ?? 'pending');
	const status = parsed.success ? parsed.data : 'pending';
	const offset = z
		.string()
		.regex(/^\d+$/)
		.transform(Number)
		.pipe(z.number().int().min(0).max(2_147_483_647))
		.safeParse(url.searchParams.get('offset') ?? '0');
	if (!offset.success) {
		error(400, serverT('admin.error.invalidCommentOffset'));
	}
	const result = await adminListComments(request.headers.get('cookie'), status, offset.data);
	return {
		items: result?.items ?? [],
		status,
		offset: offset.data,
		hasMore: result?.hasMore ?? false,
		online: result !== null,
		notice: url.searchParams.has('updated') ? serverT('admin.comments.updated') : null
	};
};

export const actions: Actions = {
	/** @brief Changes moderation state. @param event Form request. @return Failure or redirect. */
	moderate: async ({ request, url }) => {
		const form = await request.formData();
		const id = z.uuid().safeParse(form.get('id'));
		const status = commentStatusSchema.safeParse(form.get('status'));
		if (!id.success || !status.success) {
			return fail(400, { error: serverT('admin.error.invalidModeration') });
		}
		const result = await adminModerateComment(request.headers.get('cookie'), id.data, status.data);
		if (!result.ok) {
			return fail(400, { error: result.error });
		}
		throw redirect(
			303,
			`/admin/comments?status=${encodeURIComponent(url.searchParams.get('status') ?? 'pending')}&offset=${encodeURIComponent(url.searchParams.get('offset') ?? '0')}&updated=1`
		);
	},
	/** @brief Deletes one comment. @param event Form request. @return Failure or redirect. */
	delete: async ({ request, url }) => {
		const form = await request.formData();
		const id = z.uuid().safeParse(form.get('id'));
		if (!id.success) {
			return fail(400, { error: serverT('admin.error.invalidComment') });
		}
		const result = await adminDeleteComment(request.headers.get('cookie'), id.data);
		if (!result.ok) {
			return fail(400, { error: result.error });
		}
		throw redirect(
			303,
			`/admin/comments?status=${encodeURIComponent(url.searchParams.get('status') ?? 'pending')}&offset=${encodeURIComponent(url.searchParams.get('offset') ?? '0')}&updated=1`
		);
	}
};
