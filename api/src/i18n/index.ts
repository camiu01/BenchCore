/**
 * @file index.ts
 * @brief Chooses the response language from the request and renders API messages.
 */
import type { IncomingMessage } from 'node:http';
import { parseCookies } from '../auth/session.js';
import { apiMessages } from './messages.js';
import type { ApiLocale, ApiMessageKey } from './messages.js';

export type { ApiLocale, ApiMessageKey } from './messages.js';

/** Cookie holding the visitor's explicit language choice, shared with the frontend. */
export const LOCALE_COOKIE = 'lang';

/** Placeholder values for one message. */
export type MessageParams = Record<string, string | number>;

/**
 * @brief Narrows a value to a supported API language.
 * @param value Candidate code.
 * @return True when the API can answer in it.
 */
function isApiLocale(value: unknown): value is ApiLocale {
	return value === 'en' || value === 'it';
}

/**
 * @brief Picks the highest-weighted supported language from an Accept-Language header.
 * @param header Raw header value.
 * @return Supported language or null.
 */
export function parseAcceptLanguage(header: string | undefined): ApiLocale | null {
	if (!header || header.length > 500) { return null; }
	const ranked = header.split(',').map((part, index) => {
		const [tag = '', ...params] = part.trim().split(';');
		const weight = params.map((param) => /^\s*q=([0-9.]+)\s*$/.exec(param)?.[1]).find(Boolean);
		return { tag: tag.trim().toLowerCase(), q: weight === undefined ? 1 : Number(weight), index };
	}).filter((entry) => entry.tag !== '' && Number.isFinite(entry.q) && entry.q > 0)
		.sort((a, b) => b.q - a.q || a.index - b.index);
	for (const entry of ranked) {
		const primary = entry.tag.split('-')[0];
		if (isApiLocale(primary)) { return primary; }
	}
	return null;
}

/**
 * @brief Chooses the response language: language cookie, then Accept-Language, then English.
 * @param req Incoming request.
 * @return The language for human-readable messages.
 */
export function requestLocale(req: IncomingMessage): ApiLocale {
	const cookie = parseCookies(req.headers.cookie)[LOCALE_COOKIE];
	if (isApiLocale(cookie)) { return cookie; }
	return parseAcceptLanguage(req.headers['accept-language']) ?? 'en';
}

/**
 * @brief Renders one API message in a language, filling `{name}` placeholders.
 * @param locale Target language.
 * @param key Message identifier.
 * @param params Placeholder values.
 * @return The localized text.
 */
export function renderMessage(locale: ApiLocale, key: ApiMessageKey, params?: MessageParams): string {
	const template: string = apiMessages[key][locale];
	if (params === undefined) { return template; }
	return template.replace(/\{(\w+)\}/g, (match, name: string) => {
		const value = params[name];
		return value === undefined ? match : String(value);
	});
}

/**
 * @brief Renders one API message in the language of a request.
 * @param req Incoming request.
 * @param key Message identifier.
 * @param params Placeholder values.
 * @return The localized text.
 */
export function apiMessage(req: IncomingMessage, key: ApiMessageKey, params?: MessageParams): string {
	return renderMessage(requestLocale(req), key, params);
}
