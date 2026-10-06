/**
 * @file post-preview.ts
 * @brief Lightweight linked-post previews with the same publication and audience rules as reading.
 */
import type { PostServiceDeps } from './post-service.js';
import { canReadPost } from './audience.js';
import { isPublic, normalizeSlug } from './publishing.js';

/** @brief Projects only visible metadata, never bodies or protected covers. @param deps Repositories and viewer. @param slug Target. @param now Visibility reference time. @return Preview or a uniform missing result. */
export async function getPublishedPreview(deps: PostServiceDeps, slug: string, now = new Date()) {
	const row = await deps.posts.findBySlug(normalizeSlug(slug));
	if (!row || !isPublic(row.status, row.publishedAt, now) || row.publishAt && row.publishAt > now) return null;
	const locked = !canReadPost(row.audience, deps.viewerRole);
	return {
		slug: row.slug, title: row.title, locked, publishedAt: row.publishedAt?.toISOString() ?? null,
		description: locked ? '' : row.description, coverImage: locked ? null : row.coverImage,
		tags: await deps.tags.getPostTagNames(row.id)
	};
}
