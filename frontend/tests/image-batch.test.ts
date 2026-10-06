/**
 * @file image-batch.test.ts
 * @brief Multiple upload ordering, partial failure and automatic insertion coverage.
 */
import { describe, expect, it, vi } from 'vitest';
import { imageUploadQueue, insertUploadedImage, uploadImageBatch } from '../src/lib/image-batch.js';

/**
 * @brief Creates a minimal live editor and cover fixture.
 * @param content Initial Markdown.
 * @param cover Initial cover.
 * @return Mutable field fixtures.
 */
function fields(content = '', cover = '') {
	const textarea = {
		value: content,
		setRangeText(text: string, start: number, end: number) {
			this.value = this.value.slice(0, start) + text + this.value.slice(end);
		},
		dispatchEvent: vi.fn()
	};
	const input = { value: cover, dispatchEvent: vi.fn() };
	return {
		textarea: textarea as unknown as HTMLTextAreaElement,
		cover: input as unknown as HTMLInputElement
	};
}

describe('multiple image uploads', () => {
	it('uploads in selection order and retries only failed images', async () => {
		const files = ['one.png', 'two.png', 'three.png'].map(
			(name) => new File(['image'], name, { type: 'image/png' })
		);
		const queue = imageUploadQueue(files);
		const upload = vi
			.fn()
			.mockResolvedValueOnce('/api/media/one.png')
			.mockRejectedValueOnce(new Error('CORS blocked'))
			.mockResolvedValueOnce('/api/media/three.png');
		const inserted = vi.fn();
		await uploadImageBatch(queue, inserted, () => undefined, upload);
		expect(queue.map((item) => item.status)).toEqual(['uploaded', 'failed', 'uploaded']);
		expect(queue[1]?.error).toBe('CORS blocked');
		expect(inserted.mock.calls.map((call) => call[0])).toEqual([
			'/api/media/one.png',
			'/api/media/three.png'
		]);
		const retry = vi.fn().mockResolvedValue('/api/media/two.png');
		await uploadImageBatch(queue, inserted, () => undefined, retry);
		expect(retry).toHaveBeenCalledExactlyOnceWith(files[1], expect.any(Function));
		expect(queue.every((item) => item.status === 'uploaded')).toBe(true);
	});

	it('caps each batch at twenty files', () => {
		const files = Array.from({ length: 25 }, () => new File(['image'], 'image.png'));
		expect(imageUploadQueue(files)).toHaveLength(20);
	});

	it('inserts each image at the captured cursor without deleting text', () => {
		const { textarea, cover } = fields('BeforeAfter');
		const cursor = insertUploadedImage(textarea, cover, '/api/media/one.png', 6, 'one.png');
		insertUploadedImage(textarea, cover, '/api/media/two.png', cursor, 'two.png');
		expect(textarea.value).toBe(
			'Before\n\n![one](/api/media/one.png)\n\n![two](/api/media/two.png)\n\nAfter'
		);
		expect(cover.value).toBe('/api/media/one.png');
		expect(textarea.dispatchEvent).toHaveBeenCalledTimes(2);
	});

	it('preserves a manually chosen cover and escapes filename brackets', () => {
		const { textarea, cover } = fields('', 'https://example.test/cover.png');
		insertUploadedImage(textarea, cover, '/api/media/image.png', 0, 'diagram[1].png');
		expect(textarea.value).toContain('![diagram\\[1\\]]');
		expect(cover.value).toBe('https://example.test/cover.png');
		expect(cover.dispatchEvent).not.toHaveBeenCalled();
	});
});
