/**
 * @file +server.ts
 * @brief Public crawler discovery excluding private, authentication and API routes.
 */
import { siteBase } from '../../lib/site.js';
import type { RequestHandler } from './$types';

/**
 * @brief Serves crawler directions; access control is enforced separately.
 * @return Plain-text directives and the configured canonical sitemap URL.
 */
export const GET: RequestHandler = () => {
	const base = siteBase();
	const excluded = [
		'/admin',
		'/account',
		'/login',
		'/logout',
		'/register',
		'/forgot-password',
		'/reset-password',
		'/language',
		'/api/'
	];
	const body = `User-agent: *\nAllow: /\n${excluded.map((path) => `Disallow: ${path}\n`).join('')}Sitemap: ${base}/sitemap.xml\n`;
	return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
