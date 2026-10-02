/**
 * @file site.ts
 * @brief Trusted, server-only site configuration for canonical links and API origins.
 */

/**
 * @brief Returns the public site base URL for canonical links and feeds.
 * @returns The configured site URL.
 */
export function siteBase(): string {
	const configured =
		process.env['SITE_URL'] || process.env['PUBLIC_SITE_URL'] || 'http://localhost:5173';
	const url = new URL(configured);
	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
		throw new Error('SITE_URL must be an HTTP(S) site URL without credentials.');
	}
	return url.origin;
}

/**
 * @brief Returns the configured, trusted origin for server-to-server mutations.
 * @return The canonical site origin, never a browser-supplied header.
 */
export function mutationOrigin(): string {
	return siteBase();
}
