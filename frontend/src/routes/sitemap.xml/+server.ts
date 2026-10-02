/**
 * @file +server.ts
 * @brief Paginated, XML-safe sitemap containing every public post and tag.
 */
import { getPostsPage, getTags } from '../../lib/api.js';
import { siteBase } from '../../lib/site.js';
import { escapeXml } from '../../lib/server/xml.js';
import type { RequestHandler } from './$types';

/**
 * @brief Builds a safely escaped sitemap entry.
 * @param loc The canonical URL.
 * @param lastmod The optional last-modified date.
 * @return The XML entry.
 */
function entry(loc: string, lastmod?: string): string {
	const modified = lastmod === undefined ? '' : `<lastmod>${escapeXml(lastmod)}</lastmod>`;
	return `<url><loc>${escapeXml(loc)}</loc>${modified}</url>\n`;
}

/**
 * @brief Serves every public post rather than truncating the first page.
 * @return The sitemap or a non-cacheable temporary outage.
 */
export const GET: RequestHandler = async () => {
	const base = siteBase();
	let body = '<?xml version="1.0" encoding="UTF-8"?>\n';
	body += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
	body += entry(base) + entry(`${base}/posts`) + entry(`${base}/tags`);
	let offset = 0;
	while (true) {
		const page = await getPostsPage(100, offset);
		if (page === null) {
			return new Response('API unavailable', {
				status: 503,
				headers: { 'cache-control': 'no-store' }
			});
		}
		for (const post of page.items) {
			body += entry(
				`${base}/posts/${encodeURIComponent(post.slug)}`,
				post.publishedAt === null ? undefined : post.publishedAt.slice(0, 10)
			);
		}
		offset += page.items.length;
		if (offset >= page.total || page.items.length === 0) {
			break;
		}
	}
	const tags = await getTags();
	if (tags === null) {
		return new Response('API unavailable', {
			status: 503,
			headers: { 'cache-control': 'no-store' }
		});
	}
	for (const tag of tags.items) {
		body += entry(`${base}/tags/${encodeURIComponent(tag.name)}`);
	}
	return new Response(`${body}</urlset>`, {
		headers: { 'content-type': 'application/xml; charset=utf-8' }
	});
};
