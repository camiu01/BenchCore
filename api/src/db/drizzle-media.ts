/**
 * @file drizzle-media.ts
 * @brief PostgreSQL implementation of the binary media repository.
 */
import { eq } from 'drizzle-orm';
import type { AppDb } from './client.js';
import type { MediaBlobRepository } from './media-repository.js';
import { mediaBlobs } from './schema.js';

/**
 * @brief Creates a database media repository.
 * @param db The database handle.
 * @return The blob persistence repository.
 */
export function createDrizzleMedia(db: AppDb): MediaBlobRepository {
	return {
		/** @brief Finds one record without its binary payload. @param storageKey Managed key. @return Metadata or null. */
		async describe(storageKey) {
			const { key, filename, mime, sizeBytes } = mediaBlobs;
			const rows = await db.select({ key, filename, mime, sizeBytes }).from(mediaBlobs)
				.where(eq(key, storageKey)).limit(1);
			return rows[0] ?? null;
		},
		/**
		 * @brief Inserts a media record.
		 * @param blob The record and payload.
		 * @return Resolves after the insert.
		 */
		async save(blob) { await db.insert(mediaBlobs).values(blob); },
		/**
		 * @brief Looks up a media record.
		 * @param key The storage key.
		 * @return The blob or null.
		 */
		async load(key) {
			const rows = await db.select().from(mediaBlobs).where(eq(mediaBlobs.key, key)).limit(1);
			return rows[0] ?? null;
		},
		/**
		 * @brief Deletes one media record.
		 * @param key The storage key.
		 * @return Whether a record was deleted.
		 */
		async remove(key) {
			const rows = await db.delete(mediaBlobs).where(eq(mediaBlobs.key, key)).returning({ key: mediaBlobs.key });
			return rows.length > 0;
		},
		/**
		 * @brief Lists metadata without binary data.
		 * @return All stored metadata.
		 */
		async list() {
			const { key, filename, mime, sizeBytes } = mediaBlobs;
			return db.select({ key, filename, mime, sizeBytes }).from(mediaBlobs).orderBy(filename);
		}
	};
}
