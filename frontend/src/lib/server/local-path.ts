/**
 * @file local-path.ts
 * @brief Accepts only same-site absolute paths for post-action redirects.
 */

/**
 * @brief Validates a redirect target so it can never leave the site.
 * @param value Untrusted form value.
 * @return The path with its query string, or `/` when unsafe.
 */
export function safeLocalPath(value: unknown): string {
	if (typeof value !== 'string' || value.length > 300) return '/';
	if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
	for (let index = 0; index < value.length; index += 1) {
		if (value.charCodeAt(index) < 0x20) return '/';
	}
	return value;
}
