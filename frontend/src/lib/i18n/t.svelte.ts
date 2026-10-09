/**
 * @file t.svelte.ts
 * @brief Reactive translator for Svelte templates, driven by the layout's locale.
 */
import { page } from '$app/state';
import { DEFAULT_LOCALE, isLocale } from './locale.js';
import type { Locale } from './locale.js';
import { translate } from './translate.js';
import type { MessageKey, MessageParams } from './translate.js';

/**
 * @brief Reads the language chosen for the current request.
 * @return The active language; reactive when called inside templates or deriveds.
 */
export function currentLocale(): Locale {
	const value: unknown = page.data['locale'];
	return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * @brief Translates one message in the current page language.
 * @param key Message identifier.
 * @param params Placeholder values.
 * @return Translated text.
 */
export function t(key: MessageKey, params?: MessageParams): string {
	return translate(currentLocale(), key, params);
}
