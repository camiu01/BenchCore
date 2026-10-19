/**
 * @file discovery.spec.ts
 * @brief Real XML parsing and SSR social metadata checks without client-side rendering.
 */
import { expect, test } from '@playwright/test';

test('RSS and sitemap are valid XML with canonical public entries', async ({ page, request }) => {
	await page.goto('/');
	for (const path of ['/rss.xml', '/sitemap.xml']) {
		const response = await request.get(path);
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toContain('xml');
		const parsed = await page.evaluate(
			(xml) => {
				const doc = new DOMParser().parseFromString(xml, 'application/xml');
				return {
					errors: doc.querySelectorAll('parsererror').length,
					root: doc.documentElement.localName,
					locations: [...doc.querySelectorAll('loc, item > link')].map((node) => node.textContent),
					descriptions: [...doc.querySelectorAll('item > description')].map(
						(node) => node.textContent
					),
					dates: [...doc.querySelectorAll('pubDate, lastmod')].map((node) => node.textContent)
				};
			},
			await response.text()
		);
		expect(parsed.errors).toBe(0);
		expect(parsed.root).toBe(path === '/rss.xml' ? 'rss' : 'urlset');
		expect(parsed.locations).toContain('http://127.0.0.1:5198/posts/accessible-engineering');
		expect(parsed.locations.some((url) => url?.includes('draft-engineering'))).toBe(false);
		expect(parsed.descriptions).not.toContain('Protected fixture description.');
		for (const date of parsed.dates) {
			expect(Number.isFinite(Date.parse(date ?? ''))).toBe(true);
		}
		if (path === '/rss.xml') {
			expect(parsed.descriptions).toContain('Circuits < signals & safe XML.');
		} else {
			expect(parsed.locations).toContain('http://127.0.0.1:5198/tags/Engineering%20%26%20circuits');
		}
	}
});

test('post and tag social metadata is present in SSR HTML', async ({ page, request }) => {
	await page.goto('/');
	for (const path of ['/posts/accessible-engineering', '/tags/Engineering%20%26%20circuits']) {
		const response = await request.get(path);
		expect(response.status()).toBe(200);
		const metadata = await page.evaluate(
			(html) => {
				const doc = new DOMParser().parseFromString(html, 'text/html');
				return Object.fromEntries(
					[...doc.head.querySelectorAll('meta')].map((node) => [
						node.getAttribute('property') ?? node.getAttribute('name'),
						node.getAttribute('content')
					])
				);
			},
			await response.text()
		);
		expect(metadata['og:url']).toBe(`http://127.0.0.1:5198${path}`);
		expect(metadata['og:title']).toBeTruthy();
		expect(metadata['og:description']).toBeTruthy();
		expect(metadata['twitter:title']).toBe(metadata['og:title']);
		expect(metadata['twitter:description']).toBe(metadata['og:description']);
		expect(metadata['twitter:card']).toBe('summary');
		expect(metadata['og:type']).toBe(path.startsWith('/posts/') ? 'article' : 'website');
	}
	const guest = await request.get('/posts/private-engineering');
	expect(await guest.text()).not.toContain('Protected fixture description.');
	expect(await guest.text()).not.toContain('Protected fixture body.');
});
