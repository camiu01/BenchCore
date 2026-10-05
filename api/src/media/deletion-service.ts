/**
 * @file deletion-service.ts
 * @brief Confirmed storage deletion with shared-post reference cleanup.
 */
import { createHash } from 'node:crypto';
import type { PostRepository } from '../db/repositories.js';
import { renderMarkdown } from '../markdown/render.js';
import type { StorageProvider } from './storage.js';
import { managedImageKey, managedImageKeys, removeImageReferences } from './references.js';

/**
 * @brief Resolves all saved uses and a confirmation fingerprint.
 * @param posts Post persistence.
 * @param key Managed media key.
 * @return Affected post rows and a version fingerprint.
 */
export async function imageUsage(posts: PostRepository, key: string) {
	const rows = (await posts.listAll())
		.filter((row) => managedImageKeys(row.contentMarkdown, row.coverImage ?? '').includes(key))
		.sort((a, b) => a.id.localeCompare(b.id));
	const version = createHash('sha256').update(JSON.stringify(rows.map((row) => ({
		id: row.id, content: row.contentMarkdown, cover: row.coverImage, updatedAt: row.updatedAt
	})))).digest('hex');
	return { rows, version };
}

/**
 * @brief Removes confirmed saved references before deleting the stored object.
 * @param posts Post persistence.
 * @param storage Configured storage provider.
 * @param key Managed media key.
 * @param version Previously confirmed usage fingerprint.
 * @return Conflict, deletion success or storage failure without dangling saved references.
 */
export async function deleteManagedImage(
	posts: PostRepository, storage: StorageProvider, key: string, version: string
): Promise<'deleted' | 'conflict' | 'storage_failed'> {
	const usage = await imageUsage(posts, key);
	if (usage.version !== version) return 'conflict';
	const patches = await Promise.all(usage.rows.map(async (row) => {
		const contentMarkdown = removeImageReferences(row.contentMarkdown, key);
		if (managedImageKeys(contentMarkdown, '').includes(key)) {
			throw new Error('image_reference_cleanup_failed');
		}
		const rendered = await renderMarkdown(contentMarkdown, { mediaPrefix: '/api/media' });
		return {
			id: row.id, expectedUpdatedAt: row.updatedAt, contentMarkdown, contentHtml: rendered.html,
			coverImage: managedImageKey(row.coverImage ?? '') === key ? null : row.coverImage
		};
	}));
	if (!await posts.updateMediaReferences(patches)) return 'conflict';
	try {
		return await storage.remove(key) ? 'deleted' : 'storage_failed';
	} catch {
		return 'storage_failed';
	}
}
