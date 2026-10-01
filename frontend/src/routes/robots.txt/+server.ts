/**
 * robots.txt: allow everything, point crawlers at the sitemap and feed.
 */
import { siteBase } from '../../lib/site.js';
import type { RequestHandler } from './$types';

/**
 * @brief Serves robots.txt.
 */
export const GET: RequestHandler = () => {
	const base = siteBase();
	const body = `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`;
	return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
