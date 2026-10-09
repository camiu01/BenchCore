/**
 * @file +layout.server.ts
 * @brief Exposes trusted canonical configuration without bundling process.env in browsers.
 */
import { siteBase } from '../lib/site.js';
import type { LayoutServerLoad } from './$types';

/**
 * @brief Loads the public canonical base for all pages.
 * @param event Resolved session context.
 * @return The canonical site base and presentation settings.
 */
export const load: LayoutServerLoad = ({ locals }) => ({
	locale: locals.locale,
	sessionRole: locals.user?.role ?? null,
	siteBase: siteBase(),
	directUploads:
		process.env['MEDIA_STORAGE'] === 'r2' ||
		(process.env['VERCEL'] === '1' && process.env['MEDIA_STORAGE'] === undefined),
	schedulerEnabled:
		process.env['SCHEDULER_ENABLED'] !== 'false' &&
		process.env['VERCEL'] !== '1' &&
		process.env['DEPLOYMENT_TARGET'] !== 'vercel'
});
