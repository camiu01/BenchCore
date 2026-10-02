/**
 * @file router.mjs
 * @brief Routes one public origin to frontend, API and operational health endpoints.
 */
import { applyRuntimeOrigin } from '../frontend/runtime.mjs';
import { requestAddress } from './settings.mjs';

/**
 * @brief Creates a single-port dispatcher, never forwarding client bridge headers.
 * @param {{ api: import('node:http').RequestListener, frontend: import('node:http').RequestListener,
 * ready: () => Promise<void>, settings: ReturnType<import('./settings.mjs').platformSettings>,
 * context: import('node:async_hooks').AsyncLocalStorage<string> }} deps Runtime dependencies.
 * @return {import('node:http').RequestListener} Dispatcher.
 */
export function createPlatformHandler(deps) {
	return (req, res) => {
		let path;
		try { path = new URL(req.url ?? '/', deps.settings.origin).pathname; }
		catch { res.writeHead(400); res.end(); return; }
		delete req.headers['x-platform-bridge'];
		delete req.headers['x-platform-peer'];
		if (['/health', '/health/live', '/health/ready'].includes(path)) {
			void sendHealth(req, res, path === '/health/ready' ? deps.ready : async () => {});
			return;
		}
		const peer = requestAddress(req, deps.settings.proxies);
		deps.context.run(peer, () => {
			if (path === '/api' || path.startsWith('/api/')) { deps.api(req, res); return; }
			applyRuntimeOrigin(req, deps.settings.origin);
			deps.frontend(req, res);
		});
	};
}

/**
 * @brief Reports generic health without database, exception or credential details.
 * @param {import('node:http').IncomingMessage} req Request.
 * @param {import('node:http').ServerResponse} res Response.
 * @param {() => Promise<void>} check Optional dependency check.
 * @return {Promise<void>} Completion.
 */
async function sendHealth(req, res, check) {
	res.setHeader('cache-control', 'no-store');
	res.setHeader('content-type', 'application/json');
	res.setHeader('x-content-type-options', 'nosniff');
	if (!['GET', 'HEAD'].includes(req.method ?? 'GET')) {
		res.writeHead(405, { allow: 'GET, HEAD' }); res.end(); return;
	}
	let status = 200;
	try { await check(); } catch { status = 503; }
	res.writeHead(status);
	res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ status: status === 200 ? 'ok' : 'unavailable' }));
}

/**
 * @brief Coalesces readiness checks and briefly caches both success and failure.
 * @param {() => Promise<void>} check Database and schema check.
 * @param {number} [ttlMs] Cache lifetime.
 * @return {() => Promise<void>} Bounded probe.
 */
export function cachedProbe(check, ttlMs = 2000) {
	let expires = 0;
	let healthy = false;
	/** @type {Promise<void> | null} */
	let pending = null;
	return async () => {
		if (Date.now() >= expires && !pending) {
			pending = Promise.resolve().then(check).then(() => { healthy = true; }, () => { healthy = false; })
				.finally(() => { expires = Date.now() + ttlMs; pending = null; });
		}
		if (pending) { await pending; }
		if (!healthy) { throw new Error('unavailable'); }
	};
}
