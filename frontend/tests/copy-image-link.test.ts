/**
 * @file copy-image-link.test.ts
 * @brief Shareable image URLs, clipboard failure handling and accessible copy controls.
 */
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import { copyImageLink, resolveImageLink } from '../src/lib/image-link.js';
import CopyImageLink from '../src/lib/components/CopyImageLink.svelte';

describe('image link copying', () => {
	it('resolves managed image paths against the site origin', () => {
		expect(resolveImageLink('/api/media/example.png', 'https://example.test')).toBe(
			'https://example.test/api/media/example.png'
		);
	});

	it('preserves an absolute HTTP image URL', () => {
		expect(resolveImageLink('https://cdn.example.test/image.png', 'https://example.test')).toBe(
			'https://cdn.example.test/image.png'
		);
	});

	it('rejects executable protocols and URLs with embedded credentials', () => {
		for (const url of [
			'javascript:alert(1)',
			'data:image/png;base64,abc',
			'ftp://example.test/a.png',
			'https://user:example-only@example.test/image.png'
		]) {
			expect(() => resolveImageLink(url, 'https://example.test')).toThrow('Invalid image link');
		}
	});

	it('writes the exact absolute URL without changing the link', async () => {
		const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
		await copyImageLink('https://example.test/api/media/example.png', clipboard);
		expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith(
			'https://example.test/api/media/example.png'
		);
	});

	it('reports unavailable or denied clipboard access instead of claiming success', async () => {
		await expect(copyImageLink('https://example.test/image.png', undefined)).rejects.toThrow(
			'Clipboard unavailable'
		);
		await expect(
			copyImageLink('https://example.test/image.png', {
				writeText: vi.fn().mockRejectedValue(new Error('Permission denied'))
			})
		).rejects.toThrow('Permission denied');
	});

	it('renders a named copy button that cannot submit the editor form', () => {
		const { body } = render(CopyImageLink, {
			props: { url: '/api/media/example.png', name: 'Example attachment' }
		});
		expect(body).toContain('Copy link');
		expect(body).toContain('aria-label="Copy image link for Example attachment"');
		expect(body).toContain('type="button"');
		expect(body).not.toContain('Link copied.');
	});
});
