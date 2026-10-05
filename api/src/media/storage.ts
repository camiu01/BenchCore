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
import { z } from 'zod';

export { createDatabaseStorage } from './database.js';

/** Accepted upload MIME types mapped to file extensions. */
const ALLOWED_MIME: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

/** Maximum accepted upload size: 5 MiB. */
export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

/** @brief Validated sidecar metadata, never trusted as a filesystem path. */
export const mediaRecord = z.object({
	key: z.string().regex(/^[A-Za-z0-9]{32}\.(png|jpg|jpeg|webp|gif)$/),
	filename: z.string(),
	mime: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
	sizeBytes: z.number().int().positive().max(MAX_MEDIA_BYTES)
});

/**
 * @brief Applies the same MIME and size guards to every backend.
 * @param data The upload bytes.
 * @param mime The declared MIME type.
 * @return The allowed filename extension.
 */
export function validateUpload(data: Buffer, mime: string): string {
	if (!Object.hasOwn(ALLOWED_MIME, mime)) {
		throw new Error(`unsupported media type: ${mime}`);
	}
	if (data.length === 0 || data.length > MAX_MEDIA_BYTES) {
		throw new Error(`media size out of bounds: ${data.length} bytes`);
	}
	return ALLOWED_MIME[mime]!;
}

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
	/** @brief Optional browser-direct upload support without server body buffering. */
	direct?: {
		/** @brief Signs a bounded upload for one authenticated administrator. */
		prepare(input: { filename: string; mime: string; sizeBytes: number }, owner: string): Promise<{ uploadUrl: string; ticket: string }>;
		/** @brief Checks the object and publishes metadata for the same administrator. */
		complete(ticket: string, owner: string): Promise<StoredMedia>;
	};
	/** @brief Optional redirect URL for files larger than serverless response limits. */
	readUrl?(key: string): Promise<string | null>;
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

/** @brief Local media provider with validated JSON sidecars. */
class LocalStorage implements StorageProvider {
	/**
	 * @brief Retains the media directory.
	 * @param dir The media directory.
	 */
	constructor(private readonly dir: string) {}

	/**
	 * @brief Resolves a key to an absolute path inside the directory.
	 * @param key The validated storage key.
	 * @return The absolute file path.
	 */
	private filePath(key: string): string {
		return join(this.dir, key);
	}

	/**
	 * @brief Validates and persists an upload with metadata.
	 * @param data The bytes.
	 * @param filename The original filename.
	 * @param mime The declared MIME.
	 * @return The metadata.
	 */
	async save(data: Buffer, filename: string, mime: string): Promise<StoredMedia> {
		const extension = validateUpload(data, mime);
		await mkdir(this.dir, { recursive: true });
		const key = `${randomUUID().replace(/-/g, '')}.${extension}`;
		const record: StoredMedia = { key, filename, mime, sizeBytes: data.length };
		await writeFile(this.filePath(key), data);
		await writeFile(`${this.filePath(key)}.json`, JSON.stringify(record));
		return record;
	}

	/**
	 * @brief Loads bytes only when metadata is valid and consistent.
	 * @param key The storage key.
	 * @return Bytes and MIME or null.
	 */
	async load(key: string): Promise<{ data: Buffer; mime: string } | null> {
		const safe = sanitizeKey(key);
		if (safe === null) {
			return null;
		}
		try {
			const [data, sidecar] = await Promise.all([
				readFile(this.filePath(safe)),
				readFile(`${this.filePath(safe)}.json`, 'utf8')
			]);
			const record = mediaRecord.parse(JSON.parse(sidecar));
			if (record.key !== safe || record.sizeBytes !== data.length) {
				return null;
			}
			return { data, mime: record.mime };
		} catch {
			return null;
		}
	}

	/**
	 * @brief Deletes upload bytes and their optional sidecar.
	 * @param key The storage key.
	 * @return Whether upload bytes existed.
	 */
	async remove(key: string): Promise<boolean> {
		const safe = sanitizeKey(key);
		if (safe === null) {
			return false;
		}
		try {
			await unlink(this.filePath(safe));
		} catch {
			return false;
		}
		await unlink(`${this.filePath(safe)}.json`).catch(() => undefined);
		return true;
	}

	/**
	 * @brief Reads validated metadata only for its matching file.
	 * @param entry The directory entry.
	 * @return Metadata or null for corrupt and unrelated entries.
	 */
	private async metadata(entry: string): Promise<StoredMedia | null> {
		if (!entry.endsWith('.json')) { return null; }
		try {
			const record = mediaRecord.parse(JSON.parse(await readFile(join(this.dir, entry), 'utf8')));
			if (`${record.key}.json` !== entry) { return null; }
			const info = await stat(this.filePath(record.key));
			return info.isFile() && info.size === record.sizeBytes ? record : null;
		} catch {
			return null;
		}
	}

	/**
	 * @brief Lists valid sidecars backed by matching upload files.
	 * @return Metadata ordered by filename.
	 */
	async list(): Promise<StoredMedia[]> {
		try {
			const entries = await readdir(this.dir);
			const records = await Promise.all(entries.map((entry) => this.metadata(entry)));
			return records.filter((record): record is StoredMedia => record !== null)
				.sort((a, b) => a.filename.localeCompare(b.filename));
		} catch {
			return [];
		}
	}
}

/**
 * @brief Creates a local-filesystem storage provider.
 * @param dir The directory holding media files plus JSON sidecars.
 * @return The provider.
 */
export function createLocalStorage(dir: string): StorageProvider {
	return new LocalStorage(dir);
}
