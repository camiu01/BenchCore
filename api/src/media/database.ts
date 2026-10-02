/**
 * @file database.ts
 * @brief Database blob storage behind the existing storage provider seam.
 */
import { randomUUID } from 'node:crypto';
import type { MediaBlobRepository } from '../db/media-repository.js';
import { sanitizeKey, validateUpload, type StorageProvider } from './storage.js';

/**
 * @brief Creates a database storage provider without depending on SQL.
 * @param repository The configurable blob persistence repository.
 * @return The media storage provider.
 */
export function createDatabaseStorage(repository: MediaBlobRepository): StorageProvider {
	return {
		/**
		 * @brief Validates and stores an upload.
		 * @param data The file bytes.
		 * @param filename The original filename.
		 * @param mime The declared MIME type.
		 * @return The stored metadata.
		 */
		async save(data, filename, mime) {
			const extension = validateUpload(data, mime);
			const key = `${randomUUID().replace(/-/g, '')}.${extension}`;
			const record = { key, filename, mime, sizeBytes: data.length };
			await repository.save({ ...record, data });
			return record;
		},
		/**
		 * @brief Loads an upload using a validated key.
		 * @param key The storage key.
		 * @return The bytes and MIME or null.
		 */
		async load(key) {
			if (sanitizeKey(key) === null) { return null; }
			const blob = await repository.load(key);
			return blob === null ? null : { data: blob.data, mime: blob.mime };
		},
		/**
		 * @brief Removes an upload using a validated key.
		 * @param key The storage key.
		 * @return Whether a blob was deleted.
		 */
		async remove(key) {
			return sanitizeKey(key) === null ? false : repository.remove(key);
		},
		/**
		 * @brief Lists all metadata ordered by filename.
		 * @return The stored metadata.
		 */
		async list() {
			return (await repository.list()).sort((a, b) => a.filename.localeCompare(b.filename));
		}
	};
}
