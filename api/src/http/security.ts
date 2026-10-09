/**
 * @file security.ts
 * @brief Exact-origin CSRF protection, security headers and bounded process-local rate limits.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ApiDeps } from './types.js';
import { sendJson } from './response.js';
import { apiMessage } from '../i18n/index.js';

const LOCAL_ORIGINS = ['http://localhost:5173', 'http://localhost:5180', 'http://localhost:5181'];
const DEFAULT_LIMIT = { windowMs: 60_000, requests: 120, loginRequests: 10, maxClients: 10_000 };

/**
 * @brief Parses trusted frontend origins, failing closed for malformed configuration.
 * @param env Environment settings.
 * @return Exact serialized origins.
 */
export function configuredOrigins(env: NodeJS.ProcessEnv): string[] {
	const raw = env['API_ALLOWED_ORIGINS'] ?? env['SITE_URL'] ?? env['PUBLIC_SITE_URL'];
	if (raw === undefined) {
		if (env['NODE_ENV'] === 'production') { throw new Error('SITE_URL or API_ALLOWED_ORIGINS is required'); }
		return LOCAL_ORIGINS;
	}
	return raw.split(',').map((value) => {
		const url = new URL(value.trim());
		if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
			|| url.pathname !== '/' || url.search || url.hash) {
			throw new Error('API origins must be HTTP(S) origins without credentials, paths or queries');
		}
		return url.origin;
	});
}

/**
 * @brief Installs headers before routing so errors and media are protected too.
 * @param res Response stream.
 * @param secure Whether HTTPS is enforced.
 * @return Nothing.
 */
export function securityHeaders(res: ServerResponse, secure: boolean): void {
	res.setHeader('x-content-type-options', 'nosniff');
	res.setHeader('x-frame-options', 'DENY');
	res.setHeader('referrer-policy', 'no-referrer');
	res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
	res.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
	res.setHeader('cache-control', 'no-store');
	if (secure) { res.setHeader('strict-transport-security', 'max-age=31536000'); }
}

/**
 * @brief Creates a rate limiter isolated to a server instance; proxy headers are not trusted.
 * @param deps API dependencies and limits.
 * @return Guard that sends 403 or 429 when requests are rejected.
 */
export function createSecurityGuard(deps: ApiDeps): (req: IncomingMessage, res: ServerResponse, url: URL) => boolean {
	const limits = { ...DEFAULT_LIMIT, ...deps.rateLimit };
	const origins = new Set(deps.allowedOrigins ?? LOCAL_ORIGINS);
	const clients = new Map<string, { reset: number; requests: number; logins: number }>();
	/**
	 * @brief Applies origin and request quotas.
	 * @param req Request with direct peer address.
	 * @param res Response stream.
	 * @param url Parsed request URL.
	 * @return True when the request may proceed.
	 */
	return (req, res, url) => {
		const now = Date.now();
		const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method ?? 'GET');
		if (mutating && (!req.headers.origin || !origins.has(req.headers.origin))) {
			sendJson(res, 403, { error: 'forbidden', message: apiMessage(req, 'origin.untrusted') });
			return false;
		}
		const key = deps.clientAddress?.(req) ?? req.socket.remoteAddress ?? 'unknown';
		if (!clients.has(key) && clients.size >= limits.maxClients) {
			for (const [address, state] of clients) {
				if (state.reset <= now) { clients.delete(address); }
			}
			if (clients.size >= limits.maxClients) {
				sendJson(res, 429, { error: 'rate_limited' }, { 'retry-after': String(Math.ceil(limits.windowMs / 1000)) });
				return false;
			}
		}
		const existing = clients.get(key);
		const state = existing && existing.reset > now ? existing : { reset: now + limits.windowMs, requests: 0, logins: 0 };
		state.requests += 1;
		const credentials = [
			'/api/auth/login',
			'/api/auth/register',
			'/api/auth/password',
			'/api/auth/password/forgot',
			'/api/auth/password/reset'
		].includes(url.pathname);
		if (credentials) { state.logins += 1; }
		clients.set(key, state);
		if (state.requests > limits.requests || state.logins > limits.loginRequests && credentials) {
			sendJson(res, 429, { error: 'rate_limited' }, { 'retry-after': String(Math.max(1, Math.ceil((state.reset - now) / 1000))) });
			return false;
		}
		return true;
	};
}
