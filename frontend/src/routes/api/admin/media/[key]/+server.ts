/**
 * @file +server.ts
 * @brief Narrow same-origin proxy for protected media usage and deletion.
 */
import { apiBase } from '../../../../../lib/api.js';
import { apiFetch } from '../../../../../lib/server/transport.js';
import type { RequestHandler } from './$types';

/**
 * @brief Forwards a validated media key with original cookies and mutation Origin.
 * @param event Incoming request.
 * @return Upstream response or outage.
 */
const proxy: RequestHandler = async ({ params, request }) => {
	if (!/^[A-Za-z0-9]{32}\.(png|jpg|jpeg|webp|gif)$/.test(params.key)) {
		return new Response(null, { status: 404 });
	}
	const headers = new Headers();
	const details = new URL(request.url).searchParams.get('details');
	if (details !== null && details !== '1')
		return Response.json({ error: 'validation' }, { status: 400 });
	const suffix = details === '1' && request.method === 'GET' ? '?details=1' : '';
	for (const name of ['cookie', 'origin', 'content-type']) {
		const value = request.headers.get(name);
		if (value) headers.set(name, value);
	}
	try {
		const upstream = await apiFetch(`${apiBase()}/api/admin/media/${params.key}${suffix}`, {
			method: request.method,
			headers,
			...(request.method === 'DELETE' ? { body: await request.text() } : {}),
			redirect: 'manual',
			signal: AbortSignal.timeout(45_000)
		});
		return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
	} catch {
		return Response.json({ error: 'unavailable' }, { status: 502 });
	}
};
export const GET = proxy;
export const DELETE = proxy;
