/**
 * @file media-cache.ts
 * @brief Shared caches are disabled; only allowlisted audience-revalidated browser caching survives.
 */

/** @brief Copies safe cache controls from the trusted API, never public or immutable policies. @param upstream API headers. @return Private media headers. */
export function mediaCacheHeaders(upstream: Headers): Record<string, string> {
	const etag = upstream.get('etag');
	const revalidate =
		upstream.get('cache-control') === 'private, no-cache, must-revalidate' &&
		etag !== null &&
		/^"sha256-[a-f0-9]{64}"$/.test(etag);
	return {
		'cache-control': revalidate ? 'private, no-cache, must-revalidate' : 'private, no-store',
		'cdn-cache-control': 'no-store',
		'vercel-cdn-cache-control': 'no-store',
		'cloudflare-cdn-cache-control': 'no-store',
		vary: 'Cookie',
		...(revalidate ? { etag } : {})
	};
}
