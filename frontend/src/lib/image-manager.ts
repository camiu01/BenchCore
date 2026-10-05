/**
 * @file image-manager.ts
 * @brief Validated browser client for managed-image inspection and deletion.
 */
import { z } from 'zod';
import { managedImageKey, removeImageReferences } from '../../../api/src/media/references.js';
export {
	managedImageKey,
	managedImageKeys,
	removeImageReferences
} from '../../../api/src/media/references.js';

const usageSchema = z.object({
	uses: z.array(z.object({ id: z.uuid(), slug: z.string(), title: z.string() })),
	version: z.string().regex(/^[a-f0-9]{64}$/)
});
export type ImageUsage = z.infer<typeof usageSchema>;

/**
 * @brief Removes an image from live unsaved Markdown and cover fields.
 * @param textarea Live Markdown editor.
 * @param cover Live cover field.
 * @param key Deleted media key.
 * @return Nothing.
 */
export function removeImageFromEditor(
	textarea: HTMLTextAreaElement,
	cover: HTMLInputElement,
	key: string
): void {
	textarea.value = removeImageReferences(textarea.value, key);
	textarea.dispatchEvent(new Event('input', { bubbles: true }));
	if (managedImageKey(cover.value) === key) {
		cover.value = '';
		cover.dispatchEvent(new Event('input', { bubbles: true }));
	}
}

/**
 * @brief Retrieves saved post uses before irreversible deletion.
 * @param key Managed media key.
 * @param fetcher Browser fetch or test double.
 * @return Validated uses and confirmation fingerprint.
 */
export async function inspectImage(
	key: string,
	fetcher: typeof fetch = fetch
): Promise<ImageUsage> {
	const response = await fetcher(`/api/admin/media/${encodeURIComponent(key)}`);
	if (!response.ok) throw new Error('Cannot check image usage. Please retry.');
	return usageSchema.parse(await response.json());
}

/**
 * @brief Deletes a managed image after confirming its current saved uses.
 * @param key Managed media key.
 * @param version Confirmed usage fingerprint.
 * @param fetcher Browser fetch or test double.
 * @return Completion.
 */
export async function deleteImage(
	key: string,
	version: string,
	fetcher: typeof fetch = fetch
): Promise<void> {
	const response = await fetcher(`/api/admin/media/${encodeURIComponent(key)}`, {
		method: 'DELETE',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ version })
	});
	if (response.status === 409) throw new Error('Image usage changed. Check again before deleting.');
	if (response.status === 502)
		throw new Error('Storage deletion failed. Saved references may have been removed; retry.');
	if (!response.ok) throw new Error('Image deletion failed. Please retry.');
}
