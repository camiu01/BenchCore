/**
 * @file storage.test.ts
 * @brief Unit tests for the local media storage provider.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabaseStorage, createLocalStorage, MAX_MEDIA_BYTES, sanitizeKey } from '../src/media/storage.js';
import type { MediaBlob, MediaBlobRepository } from '../src/db/media-repository.js';

/** Minimal 1x1 PNG payload. */
const PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const directories: string[] = [];

/**
 * @brief Creates an isolated temporary media directory.
 * @return The directory path.
 */
async function directory(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), 'blog-storage-test-'));
	directories.push(dir);
	return dir;
}

/**
 * @brief Provides an SQL-independent blob repository test double.
 * @return The repository.
 */
function blobs(): MediaBlobRepository {
	const rows = new Map<string, MediaBlob>();
	return {
		/** @brief Saves a blob. @param blob The blob. @return Completion. */
		async save(blob) { rows.set(blob.key, { ...blob, data: Buffer.from(blob.data) }); },
		/** @brief Finds a blob. @param key The key. @return The blob or null. */
		async load(key) { return rows.get(key) ?? null; },
		/** @brief Deletes a blob. @param key The key. @return Whether removed. */
		async remove(key) { return rows.delete(key); },
		/** @brief Lists metadata. @return Stored metadata without bytes. */
		async list() { return [...rows.values()].map(({ data: _data, ...record }) => record); }
	};
}

afterEach(async () => {
	await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe.each(['local', 'database'] as const)('%s storage', (backend) => {
	/**
	 * @brief Builds the backend under test.
	 * @return An isolated storage provider.
	 */
	async function storage() {
		return backend === 'local' ? createLocalStorage(await directory()) : createDatabaseStorage(blobs());
	}

	it('saves, loads, lists and deletes uploads', async () => {
		const media = await storage();
		const data = Buffer.from(PNG_BASE64, 'base64');
		const record = await media.save(data, 'dot.png', 'image/png');
		expect(record.key).toMatch(/^[A-Za-z0-9]{32}\.png$/);
		const loaded = await media.load(record.key);
		expect(loaded?.mime).toBe('image/png');
		expect(loaded?.data.equals(data)).toBe(true);
		expect((await media.list()).map((entry) => entry.key)).toEqual([record.key]);
		expect(await media.remove(record.key)).toBe(true);
		expect(await media.load(record.key)).toBeNull();
		expect(await media.list()).toEqual([]);
		expect(await media.remove(record.key)).toBe(false);
	});

	it('rejects bad MIME types, empty files and traversal keys', async () => {
		const media = await storage();
		await expect(media.save(Buffer.from('x'), 'evil.svg', 'image/svg+xml')).rejects.toThrow();
		await expect(media.save(Buffer.from('x'), 'bad.png', 'toString')).rejects.toThrow();
		await expect(media.save(Buffer.from('x'), 'bad.png', 'constructor')).rejects.toThrow();
		await expect(media.save(Buffer.alloc(0), 'empty.png', 'image/png')).rejects.toThrow();
		await expect(media.save(Buffer.alloc(MAX_MEDIA_BYTES + 1), 'large.png', 'image/png')).rejects.toThrow();
		expect(await media.load('../secret')).toBeNull();
		expect(await media.remove('../secret')).toBe(false);
		expect(sanitizeKey('../secret')).toBeNull();
		expect(sanitizeKey('abc123.png')).toBeNull();
	});

	it('supports every accepted MIME type and lists metadata in filename order', async () => {
		const media = await storage();
		await media.save(Buffer.from('b'), 'z.jpg', 'image/jpeg');
		await media.save(Buffer.from('a'), 'a.webp', 'image/webp');
		await media.save(Buffer.from('c'), 'm.gif', 'image/gif');
		const entries = await media.list();
		expect(entries.map((entry) => entry.filename)).toEqual(['a.webp', 'm.gif', 'z.jpg']);
		expect(entries.every((entry) => !('data' in entry))).toBe(true);
	});
});

describe('local storage metadata guards', () => {
	it('ignores traversal metadata and refuses corrupt MIME on load', async () => {
		const dir = await directory();
		const media = createLocalStorage(dir);
		const record = await media.save(Buffer.from('x'), 'safe.png', 'image/png');
		await writeFile(join(dir, `${record.key}.json`), JSON.stringify({ ...record, key: '../secret' }));
		expect(await media.list()).toEqual([]);
		expect(await media.load(record.key)).toBeNull();
		await writeFile(join(dir, `${record.key}.json`), JSON.stringify({ ...record, mime: 'text/html' }));
		expect(await media.load(record.key)).toBeNull();
		expect(await media.list()).toEqual([]);
	});

	it('can remove a file whose sidecar is missing', async () => {
		const dir = await directory();
		const media = createLocalStorage(dir);
		const record = await media.save(Buffer.from('x'), 'safe.png', 'image/png');
		await unlink(join(dir, `${record.key}.json`));
		expect(await media.remove(record.key)).toBe(true);
		expect(await media.remove(record.key)).toBe(false);
	});
});
