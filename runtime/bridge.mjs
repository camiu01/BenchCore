/**
 * @file bridge.mjs
 * @brief Authenticated loopback SSR bridge retaining each browser's rate-limit identity.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

/**
 * @brief Builds one process-private context and header authenticator.
 * @return {{ context: AsyncLocalStorage<string>, address: (req: import('node:http').IncomingMessage) => string,
 * fetch: (base: string, input: string, init?: RequestInit) => Promise<Response> }} Bridge.
 */
export function createBridge() {
	const context = new AsyncLocalStorage();
	const secret = randomBytes(32).toString('hex');
	/**
	 * @brief Verifies internal requests before accepting the SSR peer identity.
	 * @param {import('node:http').IncomingMessage} req Private listener request.
	 * @return {string} Authenticated browser address or direct address.
	 */
	const address = (req) => {
		const supplied = req.headers['x-platform-bridge'];
		const peer = req.headers['x-platform-peer'];
		const valid = typeof supplied === 'string' && /^[a-f0-9]{64}$/.test(supplied)
			&& timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
		return valid && typeof peer === 'string' && isIP(peer) ? peer : req.socket.remoteAddress ?? 'unknown';
	};
	/**
	 * @brief Sends only fixed API paths to the private listener with unforgeable peer metadata.
	 * @param {string} base Private listener origin.
	 * @param {string} input Absolute upstream URL.
	 * @param {RequestInit} [init] Request options.
	 * @return {Promise<Response>} API response.
	 */
	const send = (base, input, init) => {
		const url = new URL(input);
		if (url.origin !== base || !url.pathname.startsWith('/api/')) {
			return Promise.reject(new Error('Invalid internal API target'));
		}
		const headers = new Headers(init?.headers);
		headers.set('x-platform-bridge', secret);
		headers.set('x-platform-peer', context.getStore() ?? '127.0.0.1');
		return fetch(url, { ...init, headers });
	};
	return { context, address, fetch: send };
}
