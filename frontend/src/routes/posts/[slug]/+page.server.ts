/**
 * Post detail load: one published post by slug, 404 when missing or draft.
 * API media paths are rewritten to absolute API URLs for cross-origin rendering.
 */
import { error } from '@sveltejs/kit';
import { apiBase, getPostBySlug } from '../../../lib/api.js';
import type { PageServerLoad } from './$types';

/**
 * Loads the published post for the slug route parameter.
 * @returns The post detail with absolute media URLs.
 */
export const load: PageServerLoad = async ({ params }) => {
	const post = await getPostBySlug(params.slug);
	if (post === null) {
		throw error(404, 'record not found');
	}
	const base = apiBase();
	return {
		post: {
			...post,
			contentHtml: post.contentHtml.replaceAll('src="/api/media/', `src="${base}/api/media/`)
		}
	};
};
