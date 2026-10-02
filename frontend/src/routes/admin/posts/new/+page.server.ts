/**
 * @file +page.server.ts
 * @brief * New-record page: blank editor with save/preview/upload actions.
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	adminRenderPreview,
	adminSavePost,
	adminUploadMedia,
	blankValues,
	withUploadedImage,
	valuesFromForm
} from '../../../../lib/server/admin-api.js';

/**
 * @brief Loads blank editor defaults.
 * @returns Empty values with no preview.
 * @param event The current request event.
 */
export const load: PageServerLoad = () => {
	return { values: blankValues(), previewHtml: null, uploadedUrl: null };
};

export const actions: Actions = {
	/**
	 * @brief Creates the post through the API.
	 * @param event The current request event.
	 * @return The result, or a redirect for completed mutations.
	 */
	save: async ({ request }) => {
		const values = valuesFromForm(await request.formData());
		const result = await adminSavePost(request.headers.get('cookie'), null, values);
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
