/**
 * @file guest-cache.ts
 * @brief Short process-local cache for cookie-less API reads, never for viewer sessions.
 */

interface Entry {
	expires: number;
	value: unknown;
}

const MAX_ENTRIES = 100;
const entries = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();

/** @brief Reads the freshness window; zero disables caching, as in tests. @return Milliseconds. */
export function guestCacheTtl(): number {
	const configured = Number(process.env['API_GUEST_CACHE_MS']);
	if (Number.isFinite(configured) && configured >= 0) return Math.min(configured, 60_000);
	return process.env['NODE_ENV'] === 'test' ? 0 : 15_000;
}

/** @brief Clears every stored result. @return Nothing. */
export function clearGuestCache(): void {
	entries.clear();
	pending.clear();
}

/**
 * @brief Shares one fresh guest result between visitors; failures are never stored.
 * @param key API path including its query.
 * @param load Network loader returning null on failure.
 * @param ttl Freshness window in milliseconds.
 * @param now Clock seam.
 * @return The cached or freshly loaded value.
 */
export async function guestCached<T>(
	key: string,
	load: () => Promise<T | null>,
	ttl = guestCacheTtl(),
	now = Date.now()
): Promise<T | null> {
	if (ttl <= 0) return load();
	const hit = entries.get(key);
	if (hit && hit.expires > now) return hit.value as T;
	const running = pending.get(key);
	if (running) return running as Promise<T | null>;
	const request = load()
		.then((value) => {
			if (value !== null) {
				if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value as string);
				entries.set(key, { expires: now + ttl, value });
			}
			return value;
		})
		.finally(() => pending.delete(key));
	pending.set(key, request);
	return request;
}
