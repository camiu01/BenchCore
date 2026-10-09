/**
 * @file request-locale.ts
 * @brief Carries the negotiated language through one request so API calls can forward it.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Locale } from '../i18n/locale.js';

const storage = new AsyncLocalStorage<Locale>();

/**
 * @brief Runs a callback with the request language available to outbound API calls.
 * @param locale Negotiated language.
 * @param callback Work to run.
 * @return The callback result.
 */
export function runWithLocale<T>(locale: Locale, callback: () => T): T {
	return storage.run(locale, callback);
}

/**
 * @brief Reads the language of the request being served, if any.
 * @return The negotiated language or undefined outside a request.
 */
export function requestLocale(): Locale | undefined {
	return storage.getStore();
}
