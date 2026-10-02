/**
 * @file settings.mjs
 * @brief Validates unified beta configuration without exposing database credentials.
 */
import { isIP } from 'node:net';
import { runtimeSettings } from '../frontend/runtime.mjs';

/**
 * @brief Rejects unsafe public production origins and unknown media providers.
 * @param {Record<string, string | undefined>} env Process settings.
 * @return {ReturnType<typeof runtimeSettings> & { production: boolean, proxies: Set<string> }} Settings.
 */
export function platformSettings(env) {
	const settings = runtimeSettings(env);
	const production = env['NODE_ENV'] === 'production';
	const local = ['localhost', '127.0.0.1', '[::1]'].includes(settings.origin.hostname);
	if (production && !env['SITE_URL'] && !env['PUBLIC_SITE_URL']) {
		throw new Error('Production requires SITE_URL');
	}
	if (production && settings.origin.protocol !== 'https:' && !local) {
		throw new Error('Public production requires an HTTPS origin');
	}
	if (!['local', 'database'].includes(env['MEDIA_STORAGE'] ?? 'local')) {
		throw new Error('MEDIA_STORAGE must be local or database');
	}
	let database;
	try { database = new URL(env['DATABASE_URL'] ?? ''); } catch {
		throw new Error('DATABASE_URL must be a PostgreSQL URL');
	}
	if (!['postgres:', 'postgresql:'].includes(database.protocol)) {
		throw new Error('DATABASE_URL must be a PostgreSQL URL');
	}
	const proxies = new Set((env['TRUSTED_PROXY_IPS'] ?? '').split(',').map((value) => value.trim()).filter(Boolean));
	if ([...proxies].some((value) => !isIP(value))) { throw new Error('TRUSTED_PROXY_IPS must contain exact IP addresses'); }
	return { ...settings, production, proxies };
}

/**
 * @brief Accepts a single forwarded address only from an explicitly trusted direct peer.
 * @param {import('node:http').IncomingMessage} req Browser request.
 * @param {Set<string>} proxies Trusted immediate proxy addresses.
 * @return {string} Rate-limit identity.
 */
export function requestAddress(req, proxies) {
	const direct = req.socket.remoteAddress ?? 'unknown';
	const forwarded = req.headers['x-forwarded-for'];
	return proxies.has(direct) && typeof forwarded === 'string' && isIP(forwarded)
		? forwarded : direct;
}
