/**
 * @file +server.ts
 * @brief Stores the visitor's language choice in a first-party cookie and returns to the page.
 */
import { redirect } from '@sveltejs/kit';
import {
	DEFAULT_LOCALE,
	LOCALE_COOKIE,
	LOCALE_COOKIE_MAX_AGE,
	isLocale
} from '../../lib/i18n/locale.js';
import { safeLocalPath } from '../../lib/server/local-path.js';
import type { RequestHandler } from './$types';

/**
 * @brief Saves the chosen language for one year, then redirects to a local path.
 * @param event Same-origin form post carrying `lang` and `return`.
 * @return A 303 redirect.
 */
export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const form = await request.formData();
	const lang = form.get('lang');
	cookies.set(LOCALE_COOKIE, isLocale(lang) ? lang : DEFAULT_LOCALE, {
		path: '/',
		maxAge: LOCALE_COOKIE_MAX_AGE,
		sameSite: 'lax',
		httpOnly: true,
		secure: url.protocol === 'https:'
	});
	redirect(303, safeLocalPath(form.get('return')));
};
