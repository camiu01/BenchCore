/**
 * @file runtime.mjs
 * @brief Trusted canonical origin settings for adapter-node without spoofable proxy headers.
 */

/**
 * @brief Validates runtime origin and listening settings.
 * @param {Record<string, string | undefined>} env Process environment.
 * @return {{ origin: URL, host: string, port: number }} Trusted settings.
 */
export function runtimeSettings(env) {
	const origin = new URL(env['SITE_URL'] ?? env['PUBLIC_SITE_URL'] ?? 'http://localhost:5180');
	if (
		!['http:', 'https:'].includes(origin.protocol) ||
		origin.username ||
		origin.password ||
		origin.pathname !== '/' ||
		origin.search ||
		origin.hash
	) {
		throw new Error('SITE_URL must be an HTTP(S) origin without credentials, paths or queries');
	}
	const port = Number(env['PORT'] ?? '5180');
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error('invalid frontend PORT');
	}
	return { origin, host: env['HOST'] ?? '0.0.0.0', port };
}

/**
 * @brief Overwrites private adapter headers with trusted configuration, not client claims.
 * @param {import('node:http').IncomingMessage} req Incoming request.
 * @param {URL} origin Canonical site URL.
 * @return {void} Nothing.
 */
export function applyRuntimeOrigin(req, origin) {
	req.headers['x-platform-protocol'] = origin.protocol.slice(0, -1);
	req.headers['x-platform-host'] = origin.host;
}
