/**
 * @file locale.ts
 * @brief Supported interface languages and request-time language negotiation.
 */

/** Interface languages shipped with the site. */
export const LOCALES = ['en', 'it'] as const;

export type Locale = (typeof LOCALES)[number];

/** Language used when neither the cookie nor the browser names a supported one. */
export const DEFAULT_LOCALE: Locale = 'en';

/** Cookie that stores the visitor's explicit language choice. */
export const LOCALE_COOKIE = 'lang';

/** One year, in seconds. */
export const LOCALE_COOKIE_MAX_AGE = 31_536_000;

/** Language names shown in the picker, each written in its own language. */
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', it: 'Italiano' };

/**
 * @brief Narrows an unknown value to a supported language code.
 * @param value Candidate language code.
 * @return True when the code is supported.
 */
export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * @brief Picks the best supported language from an Accept-Language header.
 * @param header Raw header value, if any.
 * @return The highest-weighted supported language, or null.
 */
export function parseAcceptLanguage(header: string | null | undefined): Locale | null {
	if (!header || header.length > 500) return null;
	const ranked = header
		.split(',')
		.map((part, index) => {
			const [tag = '', ...params] = part.trim().split(';');
			const weight = params.map((param) => /^\s*q=([0-9.]+)\s*$/.exec(param)?.[1]).find(Boolean);
			return { tag: tag.trim().toLowerCase(), q: weight === undefined ? 1 : Number(weight), index };
		})
		.filter((entry) => entry.tag !== '' && Number.isFinite(entry.q) && entry.q > 0)
		.sort((a, b) => b.q - a.q || a.index - b.index);
	for (const entry of ranked) {
		const primary = entry.tag.split('-')[0];
		if (isLocale(primary)) return primary;
	}
	return null;
}

/**
 * @brief Chooses the request language: explicit cookie, then browser preference, then English.
 * @param cookieValue Value of the language cookie, if any.
 * @param acceptLanguage Raw Accept-Language header, if any.
 * @return The language to render.
 */
export function resolveLocale(
	cookieValue: string | null | undefined,
	acceptLanguage: string | null | undefined
): Locale {
	if (isLocale(cookieValue)) return cookieValue;
	return parseAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}

/**
 * @brief Maps a site language to the BCP 47 tag used by Intl formatters.
 * @param locale Site language.
 * @return Formatter locale tag.
 */
export function intlTag(locale: Locale): string {
	return locale === 'it' ? 'it-IT' : 'en-GB';
}
