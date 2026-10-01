/**
 * RSS 2.0 feed with the newest published posts (empty when the API is offline).
 */
import { getPostsPage } from '../../lib/api.js';
import { siteBase } from '../../lib/site.js';
import type { RequestHandler } from './$types';

/**
 * @brief Escapes a string for XML embedding.
 * @param value The raw string.
 * @return The escaped string.
 */
function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * @brief Serves the RSS feed.
 */
export const GET: RequestHandler = async () => {
	const base = siteBase();
	const page = await getPostsPage(20, 0);
	let body = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n`;
	body += `  <title>Engineering Log</title>\n  <link>${base}/</link>\n`;
	body += `  <description>Personal engineering records.</description>\n`;
	for (const post of page?.items ?? []) {
		body += `  <item>\n    <title>${escapeXml(post.title)}</title>\n`;
		body += `    <link>${base}/posts/${post.slug}</link>\n`;
		body += `    <guid>${base}/posts/${post.slug}</guid>\n`;
		body += `    <description>${escapeXml(post.description)}</description>\n`;
		if (post.publishedAt !== null) {
			body += `    <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>\n`;
		}
		body += `  </item>\n`;
	}
	body += '</channel>\n</rss>';
	return new Response(body, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
};
