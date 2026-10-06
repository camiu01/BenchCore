/**
 * @file upload-progress.test.ts
 * @brief Measured signed upload progress stays credential-free and rejects failed transfers.
 */
import { describe, expect, it, vi } from 'vitest';
import { uploadWithProgress } from '../src/lib/upload-progress.js';
import { imageUploadQueue, moveQueuedImage, uploadImageBatch } from '../src/lib/image-batch.js';

describe('image progress and ordering', () => {
	it('reorders queued files and locks completed or active transfers', () => {
		const queue = imageUploadQueue(
			['one', 'two'].map((name) => new File(['image'], `${name}.png`))
		);
		expect(moveQueuedImage(queue, 1, -1).map((item) => item.file.name)).toEqual([
			'two.png',
			'one.png'
		]);
		expect(moveQueuedImage(queue, 0, -1)).toBe(queue);
		queue[0]!.status = 'uploading';
		expect(moveQueuedImage(queue, 1, -1)).toBe(queue);
	});

	it('clamps workflow progress and preserves monotonic updates', async () => {
		const queue = imageUploadQueue([new File(['image'], 'one.png')]);
		const values: number[] = [];
		await uploadImageBatch(
			queue,
			() => undefined,
			() => {
				values.push(queue[0]!.progress);
			},
			async (_file, progress) => {
				for (const value of [20, -5, 60, NaN, 200]) progress(value);
				return '/api/media/example.png';
			}
		);
		expect(values).toEqual([0, 20, 20, 60, 60, 100, 100]);
	});

	it('reports byte progress, omits credentials and rejects failed PUTs', async () => {
		const file = new File(['image'], 'one.png', { type: 'image/png' });
		const progress = vi.fn();
		const request = {
			open: vi.fn(),
			setRequestHeader: vi.fn(),
			upload: {
				onprogress: null as
					((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null
			},
			status: 200,
			responseURL: 'https://example.test/signed',
			withCredentials: true,
			timeout: 0,
			onload: null as (() => void) | null,
			send: vi.fn(() => {
				request.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
				request.onload?.();
			})
		};
		await uploadWithProgress(
			file,
			request.responseURL,
			progress,
			() => request as unknown as XMLHttpRequest
		);
		expect(request.withCredentials).toBe(false);
		expect(progress.mock.calls.map((call) => call[0])).toEqual([0, 50, 100]);
		request.status = 403;
		await expect(
			uploadWithProgress(
				file,
				request.responseURL,
				progress,
				() => request as unknown as XMLHttpRequest
			)
		).rejects.toThrow('R2 upload failed');
	});
});
