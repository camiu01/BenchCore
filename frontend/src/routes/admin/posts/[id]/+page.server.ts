/**
 * @file +page.server.ts
 * @brief * Edit-record page: loads a post by id with save/preview/delete/upload actions.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	adminDeletePost,
	adminGetPost,
	adminListPostSuggestions,
	adminRenderPreview,
	adminSavePost,
	adminUploadMedia,
	withUploadedImage,
	valuesFromForm,
	type EditorValues
} from '../../../../lib/server/admin-api.js';
import { serverT } from '../../../../lib/server/server-t.js';

/**
 * @brief Loads the post into editor values.
 * @returns The values with no preview.
 * @param event The current request event.
 */
export const load: PageServerLoad = async ({ params, request }) => {
	const cookie = request.headers.get('cookie');
	const [post, suggestions] = await Promise.all([
		adminGetPost(cookie, params.id),
		adminListPostSuggestions(cookie)
	]);
	if (post === null) {
		throw error(404, serverT('admin.error.recordNotFound'));
	}
	const values: EditorValues = {
		title: post.title,
		slug: post.slug,
		description: post.description,
		status: post.status,
		audience: post.audience,
		tags: post.tags.join(', '),
		publishedAt: post.publishedAt ?? '',
		publishAt: post.publishAt ?? '',
		coverImage: post.coverImage ?? '',
		content: post.contentMarkdown
	};
	return {
		values,
		previewHtml: null,
		uploadedUrl: null,
		status: post.status,
		wikilinkSuggestions: (suggestions ?? [])
			.filter((item) => item.id !== post.id)
			.map(({ slug, title, tags }) => ({ slug, title, tags }))
	};
};

export const actions: Actions = {
	/**
	 * @brief Updates the post through the API.
	 * @param event The current request event.
	 * @return The result, or a redirect for completed mutations.
	 */
	save: async ({ request, params }) => {
		const values = valuesFromForm(await request.formData());
		const result = await adminSavePost(request.headers.get('cookie'), params.id, values);
		if (!result.ok) {
			return fail(400, { values, previewHtml: null, uploadedUrl: null, error: result.error });
		}
		throw redirect(303, '/admin');
	},
	/**
	 * @brief Renders a preview fragment through the API.
	 * @param event The current request event.
	 * @return The result, or a redirect for completed mutations.
	 */
	preview: async ({ request }) => {
		const values = valuesFromForm(await request.formData());
		const html = await adminRenderPreview(request.headers.get('cookie'), values.content);
		return {
			values,
			previewHtml: html ?? serverT('admin.preview.renderFailed'),
			uploadedUrl: null,
			error: null
		};
	},
	/**
	 * @brief Deletes the post through the API.
	 * @param event The current request event.
	 * @return The result, or a redirect for completed mutations.
	 */
	delete: async ({ request, params }) => {
		const ok = await adminDeletePost(request.headers.get('cookie'), params.id);
		if (!ok) {
			const values = valuesFromForm(await request.formData());
			return fail(400, {
				values,
				previewHtml: null,
				uploadedUrl: null,
				error: serverT('admin.error.deleteFailed')
			});
		}
		throw redirect(303, '/admin');
	},
	/**
	 * @brief Uploads an image and echoes values for cursor insertion.
	 * @param event The current request event.
	 * @return The result, or a redirect for completed mutations.
	 */
	upload: async ({ request }) => {
		const form = await request.formData();
		const values = valuesFromForm(form);
		const file = form.get('image');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, {
				values,
				previewHtml: null,
				uploadedUrl: null,
				error: serverT('admin.error.noFile')
			});
		}
		const result = await adminUploadMedia(request.headers.get('cookie'), file);
		if (!result.ok) {
			return fail(400, { values, previewHtml: null, uploadedUrl: null, error: result.error });
		}
		return {
			values: withUploadedImage(values, result.url),
			previewHtml: null,
			uploadedUrl: result.url,
			error: null
		};
	}
};
