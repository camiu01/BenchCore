/**
 * @file frontend-security.test.ts
 * @brief Regression coverage for sessions, origins, date payloads, media proxy and SEO XML.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	adminGetPost,
	adminListPosts,
	adminListTags,
	adminRenderPreview,
	adminSavePost,
	adminUploadMedia
} from '../src/lib/server/admin-api.js';
import {
	blankValues,
	editorDate,
	payloadFromValues,
	valuesFromForm,
	withUploadedImage
} from '../src/lib/server/editor-values.js';
import { resolveSessionUser } from '../src/lib/server/session.js';
import { secureResponse } from '../src/lib/server/security.js';
import { applySessionCookie } from '../src/lib/server/auth-cookie.js';
import { escapeXml } from '../src/lib/server/xml.js';
import { mutationOrigin, siteBase } from '../src/lib/site.js';
import { getPostsPage, resolveMediaUrl } from '../src/lib/api.js';
import { GET as mediaGet } from '../src/routes/api/media/[key]/+server.js';
import { GET as sitemapGet } from '../src/routes/sitemap.xml/+server.js';
import { GET as rssGet } from '../src/routes/rss.xml/+server.js';
import { load as postsLoad } from '../src/routes/posts/+page.server.js';
import type { Cookies } from '@sveltejs/kit';

const id = 'c9186a45-ea8d-4f2f-96c4-630ffb236750';
const key = `${'a'.repeat(32)}.png`;
const user = { id, email: 'admin@example.com', name: 'Admin', role: 'admin' };
const post = {
	id,
	title: 'Record',
	slug: 'record',
	description: 'A & B',
	tags: [],
	authorName: 'Admin',
	publishedAt: '2026-01-01T00:00:00.000Z'
};

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe('session and response protection', () => {
	it('accepts validated users and rejects malformed session DTOs', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ user }))
			.mockResolvedValueOnce(Response.json({ user: { id } }))
			.mockRejectedValueOnce(new Error('offline'));
		vi.stubGlobal('fetch', fetcher);
		expect(await resolveSessionUser('session=token')).toEqual(user);
		expect(await resolveSessionUser('session=token')).toBeNull();
		expect(await resolveSessionUser('session=token')).toBeNull();
		expect(await resolveSessionUser(null)).toBeNull();
		expect(fetcher).toHaveBeenCalledTimes(3);
	});

	it.each(['/admin', '/admin/posts/new', '/login', '/logout'])('never caches %s', (path) => {
		const url = new URL(path, 'https://example.com');
		const response = secureResponse(new Response(null, { status: 303 }), {
			url,
			request: new Request(url)
		});
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(response.headers.get('x-frame-options')).toBe('DENY');
		expect(response.headers.get('strict-transport-security')).toContain('max-age=31536000');
	});

	it('does not replace the framework nonce policy', () => {
		const response = new Response(null, {
			headers: { 'content-security-policy': "script-src 'nonce-test'" }
		});
		secureResponse(response, {
			url: new URL('http://localhost/posts'),
			request: new Request('http://localhost/posts')
		});
		expect(response.headers.get('content-security-policy')).toBe("script-src 'nonce-test'");
	});

	it('uses canonical configured origins rather than request input', () => {
		vi.stubEnv('SITE_URL', 'https://blog.example.com/path/');
		vi.stubEnv('PUBLIC_SITE_URL', 'https://obsolete.example.com');
		expect(siteBase()).toBe('https://blog.example.com');
		expect(mutationOrigin()).toBe('https://blog.example.com');
		vi.stubEnv('SITE_URL', 'javascript:alert(1)');
		expect(siteBase).toThrow();
	});

	it('accepts only recognized session cookies and forces HTTPS security', () => {
		vi.stubEnv('SITE_URL', 'https://example.com');
		const set = vi.fn();
		const cookies = { set } as unknown as Cookies;
		expect(applySessionCookie(cookies, ['other=anything'])).toBe(false);
		expect(applySessionCookie(cookies, ['session=%malformed'])).toBe(false);
		expect(applySessionCookie(cookies, [`session=${'a'.repeat(43)}; Max-Age=999999999`])).toBe(
			true
		);
		expect(set).toHaveBeenCalledWith('session', 'a'.repeat(43), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: true,
			maxAge: 2592000
		});
	});
});

describe('editor and API integration', () => {
	it('uses the protected tag registry for admin-only tag names', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			Response.json({
				items: [
					{
						id: '00000000-0000-4000-8000-000000000001',
						name: 'private',
						slug: 'private',
						color: '#64748B',
						count: 0
					}
				]
			})
		);
		vi.stubGlobal('fetch', fetcher);
		expect(await adminListTags('session=token')).toMatchObject({ items: [{ name: 'private' }] });
		expect(fetcher.mock.calls[0]![0]).toContain('/api/admin/tags');
	});

	it('normalizes explicit-offset schedules and clears optional fields', () => {
		expect(editorDate('2026-10-01T20:00:00+02:00')).toBe('2026-10-01T18:00:00.000Z');
		expect(editorDate('')).toBeNull();
		expect(() => editorDate('2026-10-01T20:00')).toThrow();
		const values = { ...blankValues(), title: 'Title', slug: 'title', content: 'Content' };
		expect(payloadFromValues(values)).toMatchObject({
			coverImage: null,
			publishAt: null,
			publishedAt: null
		});
	});

	it('preserves editor values and appends uploads without a browser mount side effect', () => {
		const form = new FormData();
		form.set('title', 'Unsaved title');
		form.set('content', 'Unsaved content');
		form.set('publish_at', '2026-12-01T12:00:00Z');
		const values = valuesFromForm(form);
		const uploaded = withUploadedImage(values, `/api/media/${key}`);
		expect(uploaded.title).toBe('Unsaved title');
		expect(uploaded.publishAt).toBe('2026-12-01T12:00:00Z');
		expect(uploaded.content).toContain(`Unsaved content\n\n![](/api/media/${key})`);
	});

	it('forwards trusted origin on saves, preview and uploads', async () => {
		vi.stubEnv('SITE_URL', 'https://example.com');
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(Response.json({}, { status: 201 }))
			.mockResolvedValueOnce(Response.json({ html: '<p>safe</p>' }))
			.mockResolvedValueOnce(Response.json({ url: `/api/media/${key}` }, { status: 201 }));
		vi.stubGlobal('fetch', fetcher);
		const values = {
			...blankValues(),
			title: 'Title',
			slug: 'title',
			content: 'Content',
			publishAt: '2026-12-01T12:00:00Z'
		};
		expect(await adminSavePost('session=token', null, values)).toEqual({ ok: true });
		expect(await adminRenderPreview('session=token', 'Content')).toBe('<p>safe</p>');
		expect(
			await adminUploadMedia('session=token', new File(['png'], 'image.png', { type: 'image/png' }))
		).toEqual({ ok: true, url: `/api/media/${key}` });
		for (const [, init] of fetcher.mock.calls) {
			expect(init.headers.origin).toBe('https://example.com');
			expect(init.headers.cookie).toBe('session=token');
		}
		expect(JSON.parse(fetcher.mock.calls[0]![1].body).publishAt).toBe('2026-12-01T12:00:00.000Z');
	});

	it('returns actionable errors instead of throwing during API outages', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
		expect(await adminListPosts(null)).toBeNull();
		expect(await adminGetPost(null, id)).toBeNull();
		expect(await adminRenderPreview(null, 'Content')).toBeNull();
		expect(
			await adminSavePost(null, id, {
				...blankValues(),
				title: 'Title',
				slug: 'title',
				content: 'Content'
			})
		).toMatchObject({ ok: false });
	});

	it('rejects invalid admin response shapes and invalid upload URLs', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce(Response.json({ items: [{ id }], total: 1 }))
				.mockResolvedValueOnce(
					Response.json({ url: 'https://attacker.example/file.png' }, { status: 201 })
				)
		);
		expect(await adminListPosts(null)).toBeNull();
		expect(
			await adminUploadMedia(null, new File(['x'], 'image.png', { type: 'image/png' }))
		).toMatchObject({ ok: false });
	});

	it('rejects oversized and unsupported uploads before reading file bytes', async () => {
		const arrayBuffer = vi.fn();
		const fetcher = vi.fn();
		vi.stubGlobal('fetch', fetcher);
		const file = { size: 6 * 1024 * 1024, type: 'image/png', arrayBuffer } as unknown as File;
		expect(await adminUploadMedia(null, file)).toMatchObject({ ok: false });
		expect(
			await adminUploadMedia(null, new File(['x'], 'image.svg', { type: 'image/svg+xml' }))
		).toMatchObject({ ok: false });
		expect(arrayBuffer).not.toHaveBeenCalled();
		expect(fetcher).not.toHaveBeenCalled();
	});
});

describe('search, image proxy and discovery', () => {
	it('encodes search text independently of pagination parameters', async () => {
		const fetcher = vi.fn().mockResolvedValue(Response.json({ items: [], total: 0 }));
		vi.stubGlobal('fetch', fetcher);
		await getPostsPage(10, 20, 'A&B ?');
		const url = new URL(fetcher.mock.calls[0]![0]);
		expect(url.searchParams.get('search')).toBe('A&B ?');
		expect(url.searchParams.get('offset')).toBe('20');
	});

	it('preserves search and page state while offline', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
		const result = await postsLoad({
			request: new Request('http://localhost/posts'),
			url: new URL('http://localhost/posts?page=2&search=hello')
		} as Parameters<typeof postsLoad>[0]);
		expect(result).toMatchObject({ page: 2, search: 'hello', online: false, items: [] });
	});

	it('serves media keys at the frontend origin without exposing the internal API host', () => {
		vi.stubEnv('PUBLIC_API_URL', 'http://internal-api:3001');
		expect(resolveMediaUrl(key)).toBe(`/api/media/${key}`);
		expect(resolveMediaUrl(`/api/media/${key}`)).toBe(`/api/media/${key}`);
		expect(resolveMediaUrl(null)).toBeNull();
		expect(resolveMediaUrl('http://[')).toBeNull();
		expect(resolveMediaUrl('//external.example/image.png')).toBeNull();
		expect(resolveMediaUrl('javascript:alert(1)')).toBeNull();
	});

	it('proxies only validated image keys without fabricating anonymous credentials', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(new Response('png', { headers: { 'content-type': 'image/png' } }));
		vi.stubGlobal('fetch', fetcher);
		const invalid = await mediaGet({ params: { key: '../auth/me' } } as Parameters<
			typeof mediaGet
		>[0]);
		expect(invalid.status).toBe(404);
		expect(fetcher).not.toHaveBeenCalled();
		const response = await mediaGet({
			params: { key },
			request: new Request('http://localhost')
		} as Parameters<typeof mediaGet>[0]);
		expect(response.headers.get('content-type')).toBe('image/png');
		expect(await response.text()).toBe('png');
		expect(fetcher.mock.calls[0]![1].headers).toEqual({});
		expect(fetcher.mock.calls[0]![1].redirect).toBe('manual');
	});

	it('rejects non-image API responses and reports media outages', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce(
					new Response('<script>evil</script>', { headers: { 'content-type': 'text/html' } })
				)
				.mockRejectedValueOnce(new Error('offline'))
		);
		const event = { params: { key }, request: new Request('http://localhost') } as Parameters<
			typeof mediaGet
		>[0];
		expect((await mediaGet(event)).status).toBe(502);
		expect((await mediaGet(event)).status).toBe(502);
	});

	it('escapes XML content and paginates the complete sitemap', async () => {
		expect(escapeXml(`<&"'`)).toBe('&lt;&amp;&quot;&apos;');
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ items: [post], total: 2 }))
			.mockResolvedValueOnce(
				Response.json({
					items: [{ ...post, slug: 'second', id: 'b824fd0c-07a7-482d-858b-3d2d8ee05bf1' }],
					total: 2
				})
			)
			.mockResolvedValueOnce(Response.json({ items: [] }));
		vi.stubGlobal('fetch', fetcher);
		const response = await sitemapGet({} as Parameters<typeof sitemapGet>[0]);
		const text = await response.text();
		expect(text).toContain('/posts/record');
		expect(text).toContain('/posts/second');
		expect(new URL(fetcher.mock.calls[1]![0]).searchParams.get('offset')).toBe('1');
	});

	it('does not publish empty discovery documents on temporary outages', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
		expect((await sitemapGet({} as Parameters<typeof sitemapGet>[0])).status).toBe(503);
		expect((await rssGet({} as Parameters<typeof rssGet>[0])).status).toBe(503);
	});
});
