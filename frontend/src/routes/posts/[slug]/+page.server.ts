/**
 * @file +page.server.ts
 * @brief * Post detail load: one published post by slug, 404 when missing or draft.
 * Media is served through the narrow same-origin image proxy.
 */
import { error } from '@sveltejs/kit';
import { resolveMediaUrl, getPostBySlug } from '../../../lib/api.js';
import { siteBase } from '../../../lib/site.js';
import type { PageServerLoad } from './$types';

/**
 * @brief Loads the published post for the slug route parameter.
 * @returns The post detail with same-origin cover URLs.
 * @param event The current request event.
 */
export const load: PageServerLoad = async ({ params }) => {
	const post = await getPostBySlug(params.slug);
	if (post === null) {
		throw error(404, 'record not found');
	}
	const cover = resolveMediaUrl(post.coverImage);
	return { post, cover, coverAbsolute: cover === null ? null : new URL(cover, siteBase()).href };
};
