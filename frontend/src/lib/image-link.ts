/**
 * @file image-link.ts
 * @brief Canonical image links and explicit asynchronous clipboard operations.
 */
/** @brief Resolves a shareable HTTP image URL without embedded credentials. @param path Image URL or media path. @param origin Current site origin. @return Absolute image URL. */
export function resolveImageLink(path: string, origin: string): string {
	const link = new URL(path, origin);
	if (!['http:', 'https:'].includes(link.protocol) || link.username || link.password) {
		throw new Error('Invalid image link');
	}
	return link.href;
}

/** @brief Copies an image URL through the browser clipboard interface. @param link Absolute image URL. @param clipboard Available clipboard writer. @return Completion or a copy failure. */
export async function copyImageLink(
	link: string,
	clipboard: Pick<Clipboard, 'writeText'> | undefined
): Promise<void> {
	if (!clipboard?.writeText) throw new Error('Clipboard unavailable');
	await clipboard.writeText(link);
}
