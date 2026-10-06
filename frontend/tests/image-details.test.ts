/**
 * @file image-details.test.ts
 * @brief Protected metadata validation and non-destructive cover selection.
 */
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import { imageDetails, imageFileSize, selectImageCover } from '../src/lib/image-details.js';
import PostImages from '../src/lib/components/PostImages.svelte';

const key = `${'a'.repeat(32)}.png`;
const url = `/api/media/${key}`;

describe('image details', () => {
	it('validates metadata keys, byte limits and MIME', async () => {
		const record = { key, filename: 'Image.png', mime: 'image/png', sizeBytes: 1024 };
		const fetcher = vi.fn().mockResolvedValue(Response.json(record));
		expect(await imageDetails(url, undefined, fetcher)).toEqual(record);
		expect(fetcher.mock.calls[0]?.[0]).toBe(`/api/admin/media/${key}?details=1`);
		for (const patch of [{ key: 'other' }, { sizeBytes: 6 * 1024 * 1024 }, { mime: 'text/html' }]) {
			fetcher.mockResolvedValue(Response.json({ ...record, ...patch }));
			expect(await imageDetails(url, undefined, fetcher)).toBeNull();
		}
	});

	it('rejects unmanaged URLs without contacting an external server', async () => {
		const fetcher = vi.fn();
		expect(await imageDetails('https://example.test/picture.png', undefined, fetcher)).toBeNull();
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('formats sizes and reports missing metadata honestly', () => {
		expect(imageFileSize(68)).toBe('68 B');
		expect(imageFileSize(1536)).toBe('2 KiB');
		expect(imageFileSize(2 * 1024 * 1024)).toBe('2.0 MiB');
		expect(imageFileSize(null)).toBe('File size unavailable');
	});

	it('offers an enlarged preview and identifies the current cover', () => {
		const { body } = render(PostImages, {
			props: {
				content: `![](${url})`,
				cover: url,
				disabled: false,
				onbusy: () => undefined,
				onremoved: () => undefined,
				oncover: () => undefined
			}
		});
		expect(body).toContain(`aria-label="Enlarge image ${key}"`);
		expect(body).toContain('Close preview');
		expect(body).toContain('Current cover');
	});

	it('updates only a valid editable cover and emits dirty-state input', () => {
		const input = { value: '', disabled: false, readOnly: false, dispatchEvent: vi.fn() };
		expect(selectImageCover(input as unknown as HTMLInputElement, '../bad')).toBe(false);
		expect(selectImageCover(input as unknown as HTMLInputElement, key)).toBe(true);
		expect(input.value).toBe(url);
		expect(input.dispatchEvent).toHaveBeenCalledOnce();
		input.readOnly = true;
		expect(selectImageCover(input as unknown as HTMLInputElement, key)).toBe(false);
	});
});
