/**
 * @file +server.ts
 * @brief Narrow same-origin image proxy; never forwards cookies or arbitrary API routes.
 */
import { apiBase } from '../../../../lib/api.js';
import { apiFetch } from '../../../../lib/server/transport.js';
import type { RequestHandler } from './$types';

/**
 * @brief Retrieves one validated media key from the API.
 * @param event The route parameters.
 * @return The image stream, a uniform 404, or an upstream outage response.
 */
export const GET: RequestHandler = async ({ params }) => {
	if (!/^[A-Za-z0-9]{32}\.(png|jpg|jpeg|webp|gif)$/.test(params.key)) {
		return new Response('Not found', { status: 404 });
	}
	try {
		const upstream = await apiFetch(`${apiBase()}/api/media/${params.key}`, {
			redirect: 'error',
			signal: AbortSignal.timeout(10000)
		});
		if (!upstream.ok) {
			await upstream.body?.cancel();
			return new Response('Not found', { status: upstream.status === 404 ? 404 : 502 });
		}
		const mime = upstream.headers.get('content-type')?.split(';')[0] ?? '';
		if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mime)) {
			await upstream.body?.cancel();
			return new Response('Invalid media response', { status: 502 });
		}
		return new Response(upstream.body, {
			headers: {
				'content-type': mime,
				'x-content-type-options': 'nosniff',
				'cache-control': 'public, max-age=3600'
			}
		});
	} catch {
		return new Response('Media unavailable', { status: 502 });
	}
};
