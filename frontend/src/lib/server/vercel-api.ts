/**
 * @file vercel-api.ts
 * @brief Installs API-owned serverless transport with request-local trusted peer identity.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { createServerlessApp } from '../../../../api/src/serverless/app.js';
import { apiBase } from '../api.js';
import { siteBase } from '../site.js';

const peer = new AsyncLocalStorage<string>();
let app: ReturnType<typeof createServerlessApp> | undefined;
const key = Symbol.for('publishing.api.fetch');

/**
 * @brief Lazily initializes serverless dependencies without listeners or timer jobs.
 * @return API application.
 */
function application() {
	app ??= createServerlessApp(process.env);
	return app;
}

/**
 * @brief Routes trusted server-side API calls in-process, never to arbitrary origins.
 * @param input Fixed API URL.
 * @param init Request initialization.
 * @return API response.
 */
function bridge(input: string, init?: RequestInit): Promise<Response> {
	const url = new URL(input);
	if (url.origin !== new URL(apiBase()).origin || !url.pathname.startsWith('/api/')) {
		throw new Error('Invalid serverless API target');
	}
	return application().fetch(new Request(input, init), peer.getStore() ?? 'unknown');
}

/**
 * @brief Runs a request and its SSR calls under one validated adapter peer identity.
 * @param address Hosting adapter address.
 * @param resolve Request processing.
 * @return Request response.
 */
export function withServerlessApi(
	address: string,
	resolve: () => Promise<Response>
): Promise<Response> {
	siteBase();
	(globalThis as unknown as Record<symbol, typeof bridge>)[key] = bridge;
	return peer.run(address, resolve);
}

/**
 * @brief Dispatches public API or generic health probes without internal network ports.
 * @param request Request.
 * @param address Hosting adapter address.
 * @return API or health response.
 */
export async function serverlessResponse(request: Request, address: string): Promise<Response> {
	const path = new URL(request.url).pathname;
	try {
		if (['/health', '/health/live', '/health/ready'].includes(path)) {
			if (request.method !== 'GET') {
				return new Response(null, { status: 405, headers: { allow: 'GET' } });
			}
			if (path === '/health/ready') {
				await application().ready();
			}
			return Response.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } });
		}
		return await application().fetch(request, address);
	} catch {
		return Response.json(
			{ error: 'unavailable' },
			{ status: 503, headers: { 'cache-control': 'no-store' } }
		);
	}
}
