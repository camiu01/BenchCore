/**
 * @file audience.ts
 * @brief Shared reader-only publication access rules and safe cache headers.
 */
export type PostAudience = 'public' | 'readers';
export type ViewerRole = string | null;
export const READER_CACHE_HEADERS = { 'cache-control': 'private, no-store', vary: 'Cookie' };

/**
 * @brief Determines whether the viewer may receive a post's protected content.
 * @param audience Persisted post audience.
 * @param role Validated session role, never a request parameter.
 * @return Whether full content may be returned.
 */
export function canReadPost(audience: PostAudience, role: ViewerRole = null): boolean {
	return audience === 'public' || role === 'admin' || role === 'reader';
}
