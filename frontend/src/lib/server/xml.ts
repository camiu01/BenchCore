/**
 * @file xml.ts
 * @brief Safe XML escaping for canonical URLs and syndication metadata.
 */

/**
 * @brief Escapes raw text for XML elements and attributes.
 * @param value The raw string.
 * @return Escaped XML text.
 */
export function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}
