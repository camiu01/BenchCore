/**
 * @file +server.ts
 * @brief Proxies only public engagement routes during standalone development.
 */
import { apiBase } from '../../../lib/api.js';
import { apiFetch } from '../../../lib/server/transport.js';
import type { RequestHandler } from './$types';

/**
 * @brief Forwards one allowlisted comments or likes request.
 * @param event Incoming SvelteKit request.
 * @return Upstream response or a uniform outage.
 */
const engagementProxy: RequestHandler = async ({ params, request }) => {
	if (!/^posts\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:comments|likes)$/.test(params.path)) {
		return new Response(null, { status: 404 });
	}
	const headers = new Headers();
	for (const name of ['content-type', 'cookie', 'origin']) {
		const value = request.headers.get(name);
		if (value) headers.set(name, value);
	}
	try {
		const query = new URL(request.url).search;
		const upstream = await apiFetch(`${apiBase()}/api/${params.path}${query}`, {
			method: request.method,
			headers,
			...(request.method === 'POST' ? { body: await request.arrayBuffer() } : {}),
			redirect: 'manual',
			signal: AbortSignal.timeout(10_000)
		});
		return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
	} catch {
		return Response.json({ error: 'unavailable' }, { status: 502 });
	}
};
export const GET = engagementProxy;
export const POST = engagementProxy;
const unavailable: RequestHandler = () => new Response(null, { status: 404 });
export const PUT = unavailable;
export const PATCH = unavailable;
export const DELETE = unavailable;
export const OPTIONS = unavailable;
export const HEAD = unavailable;
