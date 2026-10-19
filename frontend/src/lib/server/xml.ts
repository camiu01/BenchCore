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
	return (
		value
			// XML 1.0 forbids these controls even when escaped as character references.
			// eslint-disable-next-line no-control-regex
			.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff\uD800-\uDFFF]/gu, '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;')
	);
}
