/**
 * Site-wide public constants for canonical URLs and feeds. Server-only.
 */

/**
 * @brief Returns the public site base URL for canonical links and feeds.
 * @returns The configured site URL.
 */
export function siteBase(): string {
	return process.env['PUBLIC_SITE_URL'] || 'http://localhost:5173';
}
