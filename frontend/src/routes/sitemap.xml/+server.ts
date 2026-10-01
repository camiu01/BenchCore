/**
 * sitemap.xml: index, records, tag pages and every published post.
 * Degrades to the static routes when the API is offline.
 */
import { getPostsPage, getTags } from '../../lib/api.js';
import { siteBase } from '../../lib/site.js';
import type { RequestHandler } from './$types';

/**
 * @brief Builds one sitemap URL entry.
 * @param loc The absolute URL.
 * @param lastmod The optional last-modified date.
 * @return The XML entry.
 */
function entry(loc: string, lastmod?: string): string {
	return `  <url><loc>${loc}</loc>${lastmod === undefined ? '' : `<lastmod>${lastmod}</lastmod>`}</url>\n`;
}

/**
 * @brief Serves the sitemap.
 */
export const GET: RequestHandler = async () => {
	const base = siteBase();
	let body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
	body += entry(base);
	body += entry(`${base}/posts`);
	body += entry(`${base}/tags`);
	const page = await getPostsPage(200, 0);
	for (const post of page?.items ?? []) {
		body += entry(
			`${base}/posts/${post.slug}`,
			post.publishedAt === null ? undefined : post.publishedAt.slice(0, 10)
		);
	}
	const tags = await getTags();
	for (const tag of tags?.items ?? []) {
		body += entry(`${base}/tags/${encodeURIComponent(tag.name)}`);
	}
	body += '</urlset>';
	return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
