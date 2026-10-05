/**
 * @file transport.ts
 * @brief Uses the private unified-runtime bridge, or normal fetch in standalone development.
 */
const bridgeKey = Symbol.for('publishing.api.fetch');
type Transport = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * @brief Calls only the fixed API URLs chosen by server-side callers.
 * @param input Absolute API URL.
 * @param init Request options.
 * @return Upstream response.
 */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
	if (process.env['API_SERVICE_URL'] !== undefined) {
		return fetch(input, { ...init, redirect: 'manual' });
	}
	const bridge = (globalThis as unknown as Record<symbol, Transport | undefined>)[bridgeKey];
	return bridge ? bridge(input, init) : fetch(input, init);
}
