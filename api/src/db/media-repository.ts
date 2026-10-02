/**
 * @file media-repository.ts
 * @brief SQL-independent persistence contract for database media blobs.
 */
import type { StoredMedia } from '../media/storage.js';

/** @brief Media metadata and its binary payload. */
export interface MediaBlob extends StoredMedia {
	data: Buffer;
}

/** @brief Persistence seam used by the database storage provider. */
export interface MediaBlobRepository {
	/**
	 * @brief Persists a blob without replacing existing keys.
	 * @param blob The metadata and bytes.
	 * @return Resolves after persistence.
	 */
	save(blob: MediaBlob): Promise<void>;
	/**
	 * @brief Finds a blob by storage key.
	 * @param key The validated key.
	 * @return The record or null.
	 */
	load(key: string): Promise<MediaBlob | null>;
	/**
	 * @brief Deletes a blob by storage key.
	 * @param key The validated key.
	 * @return Whether a record was deleted.
	 */
	remove(key: string): Promise<boolean>;
	/**
	 * @brief Lists metadata without loading binary payloads.
	 * @return Metadata ordered by filename.
	 */
	list(): Promise<StoredMedia[]>;
}
