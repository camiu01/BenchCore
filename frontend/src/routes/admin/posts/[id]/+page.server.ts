/**
 * @file +page.server.ts
 * @brief * Edit-record page: loads a post by id with save/preview/delete/upload actions.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	adminDeletePost,
	adminGetPost,
	adminRenderPreview,
	adminSavePost,
	adminUploadMedia,
	withUploadedImage,
	valuesFromForm,
	type EditorValues
} from '../../../../lib/server/admin-api.js';

/**
 * @brief Loads the post into editor values.
 * @returns The values with no preview.
 * @param event The current request event.
 */
export const load: PageServerLoad = async ({ params, request }) => {
	const post = await adminGetPost(request.headers.get('cookie'), params.id);
	if (post === null) {
		throw error(404, 'record not found');
	}
	const values: EditorValues = {
		title: post.title,
		slug: post.slug,
		description: post.description,
		status: post.status,
		tags: post.tags.join(', '),
		publishedAt: post.publishedAt ?? '',
		publishAt: post.publishAt ?? '',
		coverImage: post.coverImage ?? '',
		content: post.contentMarkdown
	};
	return { values, previewHtml: null, uploadedUrl: null, status: post.status };
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
		return { values, previewHtml: html ?? '(render failed)', uploadedUrl: null, error: null };
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
			return fail(400, { values, previewHtml: null, uploadedUrl: null, error: 'Delete failed.' });
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
				error: 'No file selected.'
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
