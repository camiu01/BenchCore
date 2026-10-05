/**
 * @file reader-posts.test.ts
 * @brief Reader gates, authenticated transport, private caches and safe sign-in destinations.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { blankValues, payloadFromValues, valuesFromForm } from '../src/lib/server/editor-values.js';
import { getPostBySlug, postDetailSchema } from '../src/lib/api.js';
import { secureResponse } from '../src/lib/server/security.js';
import { postReturnPath } from '../src/lib/server/return-path.js';
import ReaderGate from '../src/lib/components/ReaderGate.svelte';
import PostEditor from '../src/lib/components/PostEditor.svelte';
import { GET as mediaGet } from '../src/routes/api/media/[key]/+server.js';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});
const key = `${'a'.repeat(32)}.png`;

describe('reader-only frontend', () => {
	it('renders only synthetic obscured lines, with no inline styles or hidden protected text', () => {
		const { body } = render(ReaderGate, { props: { slug: 'reader-record' } });
		expect(body).toContain('READERS ONLY');
		expect(body).toContain('/login?next=%2Fposts%2Freader-record');
		expect(body).toContain('reader-placeholder');
		expect(body).not.toMatch(/\sstyle=/);
	});

	it('preserves audience through the editor, previews and submitted payloads', () => {
		const form = new FormData();
		for (const [name, value] of Object.entries({
			title: 'Members',
			slug: 'members',
			content: 'Body.',
			audience: 'readers'
		}))
			form.set(name, value);
		const values = valuesFromForm(form);
		expect(payloadFromValues(values).audience).toBe('readers');
		expect(() => payloadFromValues({ ...values, audience: 'invalid' })).toThrow();
		const { body } = render(PostEditor, {
			props: {
				values,
				isNew: true,
				previewHtml: null,
				uploadedUrl: null,
				errorMsg: null
			}
		});
		expect(body).toMatch(/value="readers"[^>]*selected/);
		expect(blankValues().audience).toBe('public');
	});

	it('forwards sessions to the trusted API and accepts safe locked DTOs', async () => {
		const dto = {
			id: '11111111-1111-4111-8111-111111111111',
			slug: 'reader-record',
			title: 'Visible',
			description: '',
			tags: [],
			authorName: null,
			publishedAt: null,
			audience: 'readers',
			locked: true,
			contentHtml: '',
			coverImage: null,
			readingMinutes: 0,
			backlinks: []
		};
		const fetcher = vi.fn().mockResolvedValue(Response.json(dto));
		vi.stubGlobal('fetch', fetcher);
		expect((await getPostBySlug('reader-record', 'session=fixture'))?.locked).toBe(true);
		expect(fetcher.mock.calls[0]![1].headers).toEqual({ cookie: 'session=fixture' });
		expect(postDetailSchema.safeParse(dto).success).toBe(true);
	});

	it.each(['/', '/posts', '/posts/reader-record', '/tags/members', '/graph'])(
		'prevents personalized page caching on %s',
		(path) => {
			const url = new URL(path, 'https://example.test');
			const response = secureResponse(
				new Response('ok', { headers: { vary: 'Accept-Encoding' } }),
				{
					url,
					request: new Request(url)
				}
			);
			expect(response.headers.get('cache-control')).toBe('private, no-store');
			expect(response.headers.get('vary')).toContain('Cookie');
			expect(response.headers.get('vary')).toContain('Accept-Encoding');
		}
	);

	it('allows only local post return destinations after sign-in', () => {
		expect(postReturnPath('/posts/reader-record')).toBe('/posts/reader-record');
		for (const path of [
			'//evil.test',
			'https://evil.test',
			'/admin',
			'/posts/../admin',
			'/posts/%2F%2Fevil',
			null
		]) {
			expect(postReturnPath(path)).toBeNull();
		}
	});

	it('forwards image sessions only to the API and never follows a storage redirect with them', async () => {
		const location = `https://${'a'.repeat(32)}.r2.cloudflarestorage.com/bucket/image?signature=test`;
		const fetcher = vi
			.fn()
			.mockResolvedValue(new Response(null, { status: 307, headers: { location } }));
		vi.stubGlobal('fetch', fetcher);
		const response = await mediaGet({
			params: { key },
			request: new Request('http://localhost', { headers: { cookie: 'session=fixture' } })
		} as Parameters<typeof mediaGet>[0]);
		expect(fetcher).toHaveBeenCalledOnce();
		expect(fetcher.mock.calls[0]![1]).toMatchObject({
			headers: { cookie: 'session=fixture' },
			redirect: 'manual'
		});
		expect(response.status).toBe(307);
		expect(response.headers.get('location')).toBe(location);
		expect(response.headers.get('cache-control')).toContain('no-store');
	});

	it('rejects arbitrary image redirect hosts', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(null, {
					status: 307,
					headers: { location: 'https://evil.test/image' }
				})
			)
		);
		const event = { params: { key }, request: new Request('http://localhost') } as Parameters<
			typeof mediaGet
		>[0];
		expect((await mediaGet(event)).status).toBe(502);
	});
});
