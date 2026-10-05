/**
 * @file direct-upload.test.ts
 * @brief R2 upload stays browser-direct, bounded and free of cross-origin session cookies.
 */
import { describe, expect, it, vi } from 'vitest';
import { directImageUpload } from '../src/lib/direct-upload.js';

const uploadUrl = `https://${'a'.repeat(32)}.r2.cloudflarestorage.com/test-media/staging/image.png?signed=fixture`;
const mediaUrl = `/api/media/${'b'.repeat(32)}.png`;

describe('browser-direct media uploads', () => {
	it('sends only metadata through the API and bytes to R2 without credentials', async () => {
		const file = new File([new Uint8Array(5 * 1024 * 1024)], 'image.png', { type: 'image/png' });
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ uploadUrl, ticket: 'ticket' }))
			.mockResolvedValueOnce(new Response(null, { status: 200 }))
			.mockResolvedValueOnce(Response.json({ url: mediaUrl }, { status: 201 }));
		expect(await directImageUpload(file, fetcher as typeof fetch)).toBe(mediaUrl);
		expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({
			filename: 'image.png',
			mime: 'image/png',
			sizeBytes: file.size
		});
		expect(fetcher.mock.calls[1]![1]).toMatchObject({
			body: file,
			credentials: 'omit',
			redirect: 'error'
		});
		expect(JSON.parse(fetcher.mock.calls[2]![1].body)).toEqual({ ticket: 'ticket' });
	});
	it('rejects zero, oversized and unsupported files before any request', async () => {
		const fetcher = vi.fn();
		for (const file of [
			new File([], 'empty.png', { type: 'image/png' }),
			new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' }),
			new File(['script'], 'script.svg', { type: 'image/svg+xml' })
		]) {
			await expect(directImageUpload(file, fetcher as typeof fetch)).rejects.toThrow();
		}
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('never follows untrusted upload hosts or forwards session cookies there', async () => {
		const file = new File(['image'], 'image.png', { type: 'image/png' });
		for (const host of [
			'https://evil.test/upload',
			'http://example.test/upload',
			'https://user:pass@evil.test/upload'
		]) {
			const fetcher = vi
				.fn()
				.mockResolvedValue(Response.json({ uploadUrl: host, ticket: 'ticket' }));
			await expect(directImageUpload(file, fetcher as typeof fetch)).rejects.toThrow();
			expect(fetcher).toHaveBeenCalledTimes(1);
		}
	});
	it('does not complete failed PUTs or accept arbitrary media references', async () => {
		const file = new File(['image'], 'image.png', { type: 'image/png' });
		const failed = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ uploadUrl, ticket: 'ticket' }))
			.mockResolvedValueOnce(new Response(null, { status: 403 }));
		await expect(directImageUpload(file, failed as typeof fetch)).rejects.toThrow(
			'R2 upload failed'
		);
		expect(failed).toHaveBeenCalledTimes(2);
		const unsafe = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ uploadUrl, ticket: 'ticket' }))
			.mockResolvedValueOnce(new Response(null))
			.mockResolvedValueOnce(Response.json({ url: 'javascript:alert(1)' }));
		await expect(directImageUpload(file, unsafe as typeof fetch)).rejects.toThrow();
	});
});
