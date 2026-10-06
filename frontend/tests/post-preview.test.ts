/**
 * @file post-preview.test.ts
 * @brief Preview redaction, exact target validation, private proxying and no external image fetching.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPostPreview, previewCover } from '../src/lib/post-preview.js';
import { GET } from '../src/routes/api/previews/[slug]/+server.js';

afterEach(() => vi.unstubAllGlobals());
const preview = {
	slug: 'target',
	title: 'Target',
	description: 'Visible',
	locked: false,
	tags: ['topic'],
	publishedAt: '2020-01-01T00:00:00Z',
	coverImage: `/api/media/${'a'.repeat(32)}.png`
};

describe('linked previews', () => {
	it('loads only exact local targets and strips protected cover and summary defensively', async () => {
		const fetcher = vi.fn().mockResolvedValue(Response.json({ ...preview, locked: true }));
		const signal = new AbortController().signal;
		expect(await loadPostPreview('target', signal, fetcher)).toMatchObject({
			description: '',
			coverImage: null
		});
		expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
			cache: 'no-store',
			credentials: 'same-origin',
			redirect: 'error'
		});
		expect(await loadPostPreview('../private', signal, fetcher)).toBeNull();
		expect(fetcher).toHaveBeenCalledOnce();
		fetcher.mockResolvedValue(Response.json({ ...preview, slug: 'different' }));
		expect(await loadPostPreview('target', signal, fetcher)).toBeNull();
	});

	it('never loads an external cover just because a link is hovered', () => {
		expect(previewCover(preview)).toBe(preview.coverImage);
		expect(previewCover({ ...preview, coverImage: 'https://tracker.test/image.png' })).toBeNull();
		expect(previewCover({ ...preview, locked: true })).toBeNull();
	});

	it('allowlists the upstream DTO and forwards sessions only to the trusted service', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(Response.json({ ...preview, contentHtml: '<script>secret</script>' }));
		vi.stubGlobal('fetch', fetcher);
		const event = {
			params: { slug: 'target' },
			request: new Request('http://localhost/api/previews/target', {
				headers: { cookie: 'session=fixture' }
			})
		} as Parameters<typeof GET>[0];
		const response = await GET(event);
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(await response.json()).toEqual(preview);
		expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual({ cookie: 'session=fixture' });
	});
});
