/**
 * @file storage.test.ts
 * @brief Unit tests for the local media storage provider.
 */
import { describe, expect, it } from 'vitest';
import { sanitizeKey } from '../src/media/storage.js';
import { createTestRepos } from './helpers.js';

/** Minimal 1x1 PNG payload. */
const PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('local storage', () => {
	it('saves, loads, lists and deletes uploads', async () => {
		const { media } = createTestRepos();
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
	});

	it('rejects bad MIME types, empty files and traversal keys', async () => {
		const { media } = createTestRepos();
		await expect(media.save(Buffer.from('x'), 'evil.svg', 'image/svg+xml')).rejects.toThrow();
		await expect(media.save(Buffer.alloc(0), 'empty.png', 'image/png')).rejects.toThrow();
		expect(await media.load('../secret')).toBeNull();
		expect(await media.remove('../secret')).toBe(false);
		expect(sanitizeKey('../secret')).toBeNull();
		expect(sanitizeKey('abc123.png')).toBeNull();
	});
});
