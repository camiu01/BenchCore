/**
 * @file server-t.ts
 * @brief Translates messages in loaders and form actions using the current request language.
 */
import { DEFAULT_LOCALE } from '../i18n/locale.js';
import { translate } from '../i18n/translate.js';
import type { MessageKey, MessageParams } from '../i18n/translate.js';
import { requestLocale } from './request-locale.js';

/**
 * @brief Translates one message into the language of the request being served.
 * @param key Message identifier.
 * @param params Placeholder values.
 * @return Translated text; English outside a request.
 */
export function serverT(key: MessageKey, params?: MessageParams): string {
	return translate(requestLocale() ?? DEFAULT_LOCALE, key, params);
}
