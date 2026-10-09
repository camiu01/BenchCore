/**
 * @file presentation.ts
 * @brief Reader-facing navigation labels and deterministic publication dates.
 */
import { DEFAULT_LOCALE, intlTag } from './i18n/locale.js';
import type { Locale } from './i18n/locale.js';
import { translate } from './i18n/translate.js';
import type { MessageKey } from './i18n/translate.js';

const navigationLabels = new Map<string, MessageKey>([
	['/', 'nav.home'],
	['/posts', 'nav.posts'],
	['/tags', 'nav.topics'],
	['/graph', 'nav.connections'],
	['/login', 'nav.signIn'],
	['/register', 'nav.createAccount'],
	['/account', 'nav.account'],
	['/admin', 'nav.administration'],
	['/admin/posts/new', 'nav.newPost'],
	['/admin/tags', 'nav.manageTags'],
	['/admin/users', 'nav.manageUsers'],
	['/admin/comments', 'nav.reviewComments']
]);

/**
 * @brief Names a navigation destination in plain language.
 * @param href Destination URL.
 * @param fallback Custom label.
 * @param locale Display language.
 * @return Reader-facing label.
 */
export function navigationLabel(
	href: string,
	fallback: string,
	locale: Locale = DEFAULT_LOCALE
): string {
	const key = navigationLabels.get(href.split('?')[0] ?? href);
	return key === undefined ? fallback : translate(locale, key);
}

/**
 * @brief Formats a publication date consistently in SSR and browsers.
 * @param value ISO timestamp or null.
 * @param locale Display language.
 * @return Human-readable UTC date.
 */
export function publicationDate(value: string | null, locale: Locale = DEFAULT_LOCALE): string {
	const unavailable = translate(locale, 'common.dateUnavailable');
	if (!value) return unavailable;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return unavailable;
	return new Intl.DateTimeFormat(intlTag(locale), {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(date);
}
