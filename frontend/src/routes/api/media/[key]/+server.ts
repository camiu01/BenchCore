/**
 * @file +server.ts
 * @brief Narrow image proxy forwarding session cookies only to the trusted API service.
 */
import { apiBase } from '../../../../lib/api.js';
import { apiFetch } from '../../../../lib/server/transport.js';
import { mediaCacheHeaders } from '../../../../lib/server/media-cache.js';
import type { RequestHandler } from './$types';

/**
 * @brief Returns a safe storage redirect without forwarding session credentials.
 * @param upstream Trusted API redirect.
 * @return Private redirect or invalid-location failure.
 */
function storageRedirect(upstream: Response): Response {
	const location = upstream.headers.get('location');
	if (!location || !/^https:\/\/[a-f0-9]{32}\.r2\.cloudflarestorage\.com\//.test(location)) {
		return new Response('Invalid media redirect', { status: 502 });
	}
	return new Response(null, {
		status: 307,
		headers: { location, ...mediaCacheHeaders(new Headers()) }
	});
}

/**
 * @brief Retrieves one validated media key from the API.
 * @param event The route parameters.
 * @return The image stream, a uniform 404, or an upstream outage response.
 */
export const GET: RequestHandler = async ({ params, request }) => {
	if (!/^[A-Za-z0-9]{32}\.(png|jpg|jpeg|webp|gif)$/.test(params.key)) {
		return new Response('Not found', { status: 404 });
	}
	try {
		const cookie = request.headers.get('cookie');
		const headers: Record<string, string> = {};
		if (cookie) headers.cookie = cookie;
		const conditional = request.headers.get('if-none-match');
		if (conditional) headers['if-none-match'] = conditional;
		const upstream = await apiFetch(`${apiBase()}/api/media/${params.key}`, {
			headers,
			redirect: 'manual',
			signal: AbortSignal.timeout(10000)
		});
		if (upstream.status === 307) return storageRedirect(upstream);
		if (upstream.status === 304)
			return new Response(null, { status: 304, headers: mediaCacheHeaders(upstream.headers) });
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
				...mediaCacheHeaders(upstream.headers)
			}
		});
	} catch {
		return new Response('Media unavailable', { status: 502 });
	}
};
