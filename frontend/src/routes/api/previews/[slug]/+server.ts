/**
 * @file +server.ts
 * @brief Session-aware same-origin preview projection, never a general URL proxy.
 */
import { apiBase } from '../../../../lib/api.js';
import { apiFetch } from '../../../../lib/server/transport.js';
import { previewSchema } from '../../../../lib/post-preview.js';
import type { RequestHandler } from './$types';

const headers = {
	'cache-control': 'private, no-store',
	vary: 'Cookie',
	'cdn-cache-control': 'no-store'
};

/** @brief Retrieves and allowlists a lightweight preview from the trusted API. @param event Request and target. @return Private metadata or a uniform missing response. */
export const GET: RequestHandler = async ({ params, request }) => {
	if (!previewSchema.shape.slug.safeParse(params.slug).success)
		return Response.json({ error: 'not_found' }, { status: 404, headers });
	try {
		const cookie = request.headers.get('cookie');
		const upstream = await apiFetch(
			`${apiBase()}/api/posts/${encodeURIComponent(params.slug)}/preview`,
			{
				headers: cookie ? { cookie } : {},
				redirect: 'error',
				signal: AbortSignal.timeout(5000)
			}
		);
		if (!upstream.ok) {
			await upstream.body?.cancel();
			return Response.json(
				{ error: upstream.status === 404 ? 'not_found' : 'unavailable' },
				{ status: upstream.status === 404 ? 404 : 502, headers }
			);
		}
		const parsed = previewSchema.safeParse(await upstream.json());
		if (!parsed.success || parsed.data.slug !== params.slug) throw new Error('Invalid preview');
		const item = parsed.data;
		return Response.json(item.locked ? { ...item, description: '', coverImage: null } : item, {
			headers
		});
	} catch {
		return Response.json({ error: 'unavailable' }, { status: 502, headers });
	}
};
