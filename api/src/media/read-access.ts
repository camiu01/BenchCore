/**
 * @file read-access.ts
 * @brief Protects managed images used exclusively by reader-only posts.
 */
import type { PostRepository } from '../db/repositories.js';
import { managedImageKeys } from './references.js';

/**
 * @brief Determines whether an image has saved reader-only uses and no public uses.
 * @param posts Post persistence.
 * @param key Managed image key.
 * @return Whether reading the object requires an authenticated reader or admin.
 */
export async function isReaderMedia(posts: PostRepository, key: string): Promise<boolean> {
	const rows = (await posts.listMediaCandidates(key))
		.filter((row) => managedImageKeys(row.contentMarkdown, row.coverImage ?? '').includes(key));
	return rows.length > 0 && rows.every((row) => row.audience === 'readers');
}
