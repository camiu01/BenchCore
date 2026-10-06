/**
 * @file post-preview.ts
 * @brief Validated same-origin preview requests with no persistent client cache.
 */
import { z } from 'zod';
import { managedImageKey } from '../../../api/src/media/references.js';

export const previewSchema = z.object({
	slug: z
		.string()
		.max(200)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
	title: z.string().max(200),
	description: z.string().max(500),
	locked: z.boolean(),
	tags: z.array(z.string().max(60)).max(20),
	publishedAt: z.iso.datetime({ offset: true }).nullable(),
	coverImage: z.string().max(500).nullable()
});
export type PostPreview = z.infer<typeof previewSchema>;

/** @brief Loads only a validated local preview and checks the returned target. @param slug Target. @param signal Cancellation. @param fetcher Same-origin fetch seam. @return Metadata or null on outage/missing. */
export async function loadPostPreview(
	slug: string,
	signal: AbortSignal,
	fetcher: typeof fetch = fetch
): Promise<PostPreview | null> {
	if (!previewSchema.shape.slug.safeParse(slug).success) return null;
	try {
		const response = await fetcher(`/api/previews/${encodeURIComponent(slug)}`, {
			credentials: 'same-origin',
			cache: 'no-store',
			redirect: 'error',
			signal: AbortSignal.any([signal, AbortSignal.timeout(5000)])
		});
		if (!response.ok) return null;
		const parsed = previewSchema.safeParse(await response.json());
		if (!parsed.success || parsed.data.slug !== slug) return null;
		return parsed.data.locked ? { ...parsed.data, description: '', coverImage: null } : parsed.data;
	} catch {
		return null;
	}
}

/** @brief Avoids requesting external cover images merely because a link is hovered. @param preview Visible metadata. @return Local managed cover only. */
export function previewCover(preview: PostPreview): string | null {
	if (preview.locked || !preview.coverImage) return null;
	const key = managedImageKey(preview.coverImage);
	return key ? `/api/media/${key}` : null;
}
