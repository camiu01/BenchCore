/**
 * @file +server.ts
 * @brief RSS feed with XML-safe canonical URLs and explicit temporary outages.
 */
import { getPostsPage } from '../../lib/api.js';
import { siteBase } from '../../lib/site.js';
import { escapeXml } from '../../lib/server/xml.js';
import { PROJECT_NAME, PROJECT_TITLE } from '../../lib/branding.js';
import type { RequestHandler } from './$types';

/**
 * @brief Serves the newest public posts in an XML-safe RSS feed.
 * @return The feed or a temporary outage response.
 */
export const GET: RequestHandler = async () => {
	const base = siteBase();
	const page = await getPostsPage(20, 0);
	if (page === null) {
		return new Response('API unavailable', {
			status: 503,
			headers: { 'cache-control': 'no-store' }
		});
	}
	let body = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n`;
	body += `  <title>${escapeXml(PROJECT_NAME)}</title>\n  <link>${escapeXml(base)}/</link>\n`;
	body += `  <description>${escapeXml(PROJECT_TITLE)}</description>\n`;
	for (const post of page.items) {
		const link = escapeXml(`${base}/posts/${encodeURIComponent(post.slug)}`);
		body += `  <item>\n    <title>${escapeXml(post.title)}</title>\n`;
		body += `    <link>${link}</link>\n`;
		body += `    <guid>${link}</guid>\n`;
		body += `    <description>${escapeXml(post.description)}</description>\n`;
		if (post.publishedAt !== null) {
			body += `    <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>\n`;
		}
		body += `  </item>\n`;
	}
	body += '</channel>\n</rss>';
	return new Response(body, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
};
