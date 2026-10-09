/**
 * @file transport.ts
 * @brief Uses the private unified-runtime bridge, or normal fetch in standalone development.
 */
import { requestLocale } from './request-locale.js';

const bridgeKey = Symbol.for('publishing.api.fetch');
type Transport = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * @brief Adds the visitor's language so API messages match the page language.
 * @param init Request options.
 * @return Options carrying Accept-Language when a request language is known.
 */
function withLanguage(init?: RequestInit): RequestInit | undefined {
	const locale = requestLocale();
	if (locale === undefined) return init;
	const headers = new Headers(init?.headers);
	if (!headers.has('accept-language')) headers.set('accept-language', locale);
	return { ...init, headers };
}

/**
 * @brief Calls only the fixed API URLs chosen by server-side callers.
 * @param input Absolute API URL.
 * @param init Request options.
 * @return Upstream response.
 */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
	const options = withLanguage(init);
	if (process.env['API_SERVICE_URL'] !== undefined) {
		return fetch(input, { ...options, redirect: 'manual' });
	}
	const bridge = (globalThis as unknown as Record<symbol, Transport | undefined>)[bridgeKey];
	return bridge ? bridge(input, options) : fetch(input, options);
}
