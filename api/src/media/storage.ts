/**
 * @file storage.ts
 * @brief Media storage seam: provider contract plus local-filesystem implementation.
 *
 * The StorageProvider interface is the seam for future backends (S3, database
 * blobs, ...). Services and routes depend on the interface only.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Accepted upload MIME types mapped to file extensions. */
const ALLOWED_MIME: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

/** Maximum accepted upload size: 5 MiB. */
export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

/**
 * @brief A stored media record.
 */
export interface StoredMedia {
	key: string;
	filename: string;
	mime: string;
	sizeBytes: number;
}

/**
 * @brief Pluggable media backend contract.
 */
export interface StorageProvider {
	/**
	 * @brief Stores an upload and returns its record.
	 * @param data The file bytes.
	 * @param filename The original client filename.
	 * @param mime The declared MIME type.
	 * @return The stored record.
	 */
	save(data: Buffer, filename: string, mime: string): Promise<StoredMedia>;
	/**
	 * @brief Loads a stored file.
	 * @param key The storage key.
	 * @return The bytes plus MIME, or null when missing.
	 */
	load(key: string): Promise<{ data: Buffer; mime: string } | null>;
	/**
	 * @brief Deletes a stored file.
	 * @param key The storage key.
	 * @return True when a file was deleted.
	 */
	remove(key: string): Promise<boolean>;
	/**
	 * @brief Lists every stored record.
	 * @return The records ordered by filename.
	 */
	list(): Promise<StoredMedia[]>;
}

/**
 * @brief Validates a storage key (path-traversal guard).
 * @param raw The presented key.
 * @return The key when well-formed, otherwise null.
 */
export function sanitizeKey(raw: string): string | null {
	return /^[A-Za-z0-9]{32}\.(png|jpg|jpeg|webp|gif)$/.test(raw) ? raw : null;
}

/**
 * @brief Creates a local-filesystem storage provider.
 * @param dir The directory holding media files plus JSON sidecars.
 * @return The provider.
 */
export function createLocalStorage(dir: string): StorageProvider {
	/**
	 * @brief Resolves a key to an absolute path inside the directory.
	 * @param key The validated storage key.
	 * @return The absolute file path.
	 */
	function filePath(key: string): string {
		return join(dir, key);
	}

	return {
		async save(data: Buffer, filename: string, mime: string): Promise<StoredMedia> {
			const extension = ALLOWED_MIME[mime];
			if (extension === undefined) {
				throw new Error(`unsupported media type: ${mime}`);
			}
			if (data.length === 0 || data.length > MAX_MEDIA_BYTES) {
				throw new Error(`media size out of bounds: ${data.length} bytes`);
			}
			await mkdir(dir, { recursive: true });
			const key = `${randomUUID().replace(/-/g, '')}.${extension}`;
			const record: StoredMedia = { key, filename, mime, sizeBytes: data.length };
			await writeFile(filePath(key), data);
			await writeFile(`${filePath(key)}.json`, JSON.stringify(record));
			return record;
		},
		async load(key: string): Promise<{ data: Buffer; mime: string } | null> {
			const safe = sanitizeKey(key);
			if (safe === null) {
				return null;
			}
			try {
				const [data, sidecar] = await Promise.all([
					readFile(filePath(safe)),
					readFile(`${filePath(safe)}.json`, 'utf8')
				]);
				const record = JSON.parse(sidecar) as StoredMedia;
				return { data, mime: record.mime };
			} catch {
				return null;
			}
		},
		async remove(key: string): Promise<boolean> {
			const safe = sanitizeKey(key);
			if (safe === null) {
				return false;
			}
			try {
				await Promise.all([unlink(filePath(safe)), unlink(`${filePath(safe)}.json`)]);
				return true;
			} catch {
				return false;
			}
		},
		async list(): Promise<StoredMedia[]> {
			try {
				const entries = await readdir(dir);
				const records: StoredMedia[] = [];
				for (const entry of entries) {
					if (!entry.endsWith('.json')) {
						continue;
					}
					try {
						const record = JSON.parse(await readFile(join(dir, entry), 'utf8')) as StoredMedia;
						const info = await stat(filePath(record.key));
						if (info.isFile()) {
							records.push(record);
						}
					} catch {
						continue;
					}
				}
				return records.sort((a, b) => a.filename.localeCompare(b.filename));
			} catch {
				return [];
			}
		}
	};
}
