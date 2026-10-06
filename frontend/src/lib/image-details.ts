/**
 * @file image-details.ts
 * @brief Protected image metadata and live cover selection.
 */
import { z } from 'zod';
import { managedImageKey } from './image-manager.js';

const detailsSchema = z.object({
	key: z.string(),
	filename: z.string().max(1000),
	mime: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
	sizeBytes: z
		.number()
		.int()
		.positive()
		.max(5 * 1024 * 1024)
});
export type ImageDetails = z.infer<typeof detailsSchema>;

/** @brief Loads one protected record without retrieving the image body. @param url Managed URL. @param signal Cancellation. @param fetcher Browser fetch or test double. @return Validated details or null. */
export async function imageDetails(
	url: string,
	signal?: AbortSignal,
	fetcher: typeof fetch = fetch
): Promise<ImageDetails | null> {
	const key = managedImageKey(url);
	if (!key) return null;
	try {
		const response = await fetcher(`/api/admin/media/${key}?details=1`, {
			...(signal ? { signal } : {})
		});
		if (!response.ok) return null;
		const result = detailsSchema.safeParse(await response.json());
		return result.success && result.data.key === key ? result.data : null;
	} catch {
		return null;
	}
}

/** @brief Formats a byte count without implying unavailable metadata. @param bytes File size. @return Human-readable size. */
export function imageFileSize(bytes: number | null): string {
	if (bytes === null || !Number.isFinite(bytes) || bytes <= 0) return 'File size unavailable';
	if (bytes < 1024) return `${bytes} B`;
	return bytes < 1024 * 1024
		? `${Math.max(1, Math.round(bytes / 1024))} KiB`
		: `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

/** @brief Sets a managed cover and notifies editor state listeners. @param input Cover field. @param key Managed key. @return Whether changed. */
export function selectImageCover(input: HTMLInputElement, key: string): boolean {
	if (input.disabled || input.readOnly || managedImageKey(key) !== key) return false;
	input.value = `/api/media/${key}`;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	return true;
}
