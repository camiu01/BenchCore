/**
 * @file translate.ts
 * @brief Typed message lookup with placeholder interpolation for both server and browser code.
 */
import type { Locale } from './locale.js';
import { en, it } from './messages/index.js';
import type { MessageKey } from './messages/index.js';

export type { MessageKey } from './messages/index.js';
export type MessageParams = Record<string, string | number>;

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, it };

/**
 * @brief Looks up one message and fills its `{name}` placeholders.
 * @param locale Target language.
 * @param key Message identifier checked at compile time.
 * @param params Placeholder values.
 * @return Translated text; the key itself if a catalog is incomplete at runtime.
 */
export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
	const template = catalogs[locale][key] ?? catalogs.en[key] ?? key;
	if (params === undefined) return template;
	return template.replace(/\{(\w+)\}/g, (match, name: string) => {
		const value = params[name];
		return value === undefined ? match : String(value);
	});
}

/**
 * @brief Binds a language to the lookup for use in server actions and loaders.
 * @param locale Target language.
 * @return A translator function.
 */
export function translator(locale: Locale): (key: MessageKey, params?: MessageParams) => string {
	return (key, params) => translate(locale, key, params);
}
