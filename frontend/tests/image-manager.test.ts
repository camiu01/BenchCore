/**
 * @file image-manager.test.ts
 * @brief Image removal validation, live editor cleanup and existing-image controls.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { inspectImage, deleteImage, removeImageFromEditor } from '../src/lib/image-manager.js';
import PostImages from '../src/lib/components/PostImages.svelte';

const key = `${'a'.repeat(32)}.png`;
const url = `/api/media/${key}`;

describe('image manager', () => {
	it('lists existing post images and cover only once', () => {
		const result = render(PostImages, {
			props: {
				content: `![existing](${url})`,
				cover: url,
				disabled: false,
				onbusy: () => undefined,
				onremoved: () => undefined
			}
		});
		expect(result.body).toContain('POST IMAGES');
		expect(result.body.match(/>REMOVE</g)).toHaveLength(1);
		expect(result.body).not.toContain('DELETE FILE AND ALL REFERENCES');
	});

	it('validates usage responses before allowing a deletion', async () => {
		const fetcher = vi.fn().mockResolvedValue(Response.json({ uses: [], version: 'bad' }));
		await expect(inspectImage(key, fetcher as typeof fetch)).rejects.toThrow();
	});

	it('sends the explicit confirmation fingerprint and reports conflicts', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 409 }));
		const version = 'b'.repeat(64);
		await expect(deleteImage(key, version, fetcher as typeof fetch)).rejects.toThrow(
			'usage changed'
		);
		expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({ version });
		expect(fetcher.mock.calls[0]![1].method).toBe('DELETE');
	});

	it('removes every occurrence and the cover without losing unsaved text', () => {
		const textarea = {
			value: `Before ![one](${url}) and ![two](${url}) after`,
			dispatchEvent: vi.fn()
		};
		const cover = { value: url, dispatchEvent: vi.fn() };
		removeImageFromEditor(
			textarea as unknown as HTMLTextAreaElement,
			cover as unknown as HTMLInputElement,
			key
		);
		expect(textarea.value).toBe('Before  and  after');
		expect(cover.value).toBe('');
		expect(textarea.dispatchEvent).toHaveBeenCalledOnce();
	});
});
