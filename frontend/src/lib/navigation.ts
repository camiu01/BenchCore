/**
 * @file navigation.ts
 * @brief Public navigation labels for signed-in administrators and other visitors.
 */
import { DEFAULT_LOCALE } from './i18n/locale.js';
import type { Locale } from './i18n/locale.js';
import { translate } from './i18n/translate.js';

/**
 * @brief Chooses Login, Account or Admin to match the current session.
 * @param role Current session role or null.
 * @param index Navigation position.
 * @param locale Display language.
 * @return Navigation href and numbered label.
 */
export function authenticationLink(
	role: string | null,
	index: string,
	locale: Locale = DEFAULT_LOCALE
) {
	if (role === 'admin') {
		return { href: '/admin', label: `[${index}] ${translate(locale, 'nav.auth.admin')}` };
	}
	if (role === 'reader') {
		return { href: '/account', label: `[${index}] ${translate(locale, 'nav.auth.account')}` };
	}
	return { href: '/login', label: `[${index}] ${translate(locale, 'nav.auth.login')}` };
}
