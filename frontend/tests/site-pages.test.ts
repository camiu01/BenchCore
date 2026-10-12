/**
 * @file site-pages.test.ts
 * @brief Localized public information, safe error boundaries, crawler privacy and discovery completeness.
 */
import { page } from '$app/state';
import { render } from 'svelte/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InformationPage from '../src/lib/components/InformationPage.svelte';
import ErrorPage from '../src/lib/components/ErrorPage.svelte';
import RootError from '../src/routes/+error.svelte';
import CookiesPage from '../src/routes/cookies/+page.svelte';
import { INFO_PAGES } from '../src/lib/info-pages.js';
import { PUBLIC_SITE_PATHS, FOOTER_LINKS } from '../src/lib/site-pages.js';
import { secureResponse } from '../src/lib/server/security.js';
import { GET as robotsGet } from '../src/routes/robots.txt/+server.js';
import { GET as sitemapGet } from '../src/routes/sitemap.xml/+server.js';
import { setTestLocale } from './support/locale.js';

afterEach(() => {
	setTestLocale('en');
	Reflect.set(page, 'status', 200);
	Reflect.set(page, 'error', null);
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe('public site pages', () => {
	it.each(['en', 'it'] as const)(
		'renders every information page in %s with canonical metadata',
		(locale) => {
			setTestLocale(locale);
			for (const content of Object.values(INFO_PAGES)) {
				const result = render(InformationPage, {
					props: { content, siteBase: 'https://site.example.test', sessionRole: null }
				});
				expect(result.head).toContain(`href="https://site.example.test${content.path}"`);
				expect(result.head).toContain('property="og:type" content="website"');
				expect(result.head).not.toContain('name="robots"');
				expect(result.body.match(/<h1\b/g)).toHaveLength(1);
				expect(result.body.match(/<h2\b/g)).toHaveLength(content.sections.length);
				for (const link of FOOTER_LINKS) {
					expect(result.body).toContain(`href="${link.href}"`);
				}
				expect(result.body).toContain(`href="${content.path}" aria-current="page"`);
				expect(result.body).not.toContain('{ref}');
			}
		}
	);

	it('keeps account navigation consistent with the current session', () => {
		for (const role of ['admin', 'reader', null]) {
			const result = render(InformationPage, {
				props: {
					content: INFO_PAGES.about,
					siteBase: 'https://site.example.test',
					sessionRole: role
				}
			});
			const destination = role === 'admin' ? '/admin' : role === 'reader' ? '/account' : '/login';
			expect(result.body).toContain(`href="${destination}"`);
		}
	});

	it('documents the like cookie alongside existing browser storage', () => {
		const result = render(CookiesPage, {
			props: {
				data: {
					siteBase: 'https://site.example.test',
					sessionRole: null,
					locale: 'en',
					directUploads: false,
					schedulerEnabled: false
				}
			}
		});
		for (const name of ['session', 'lang', 'like_voter', 'site-theme', 'cookie-notice']) {
			expect(result.body).toContain(`<code>${name}</code>`);
		}
		expect(result.body).not.toContain('all four items');
	});
});

describe('error recovery', () => {
	it.each(['en', 'it'] as const)(
		'renders a safe root 404 in %s without a canonical or upstream diagnostics',
		(locale) => {
			setTestLocale(locale);
			Reflect.set(page, 'status', 404);
			Reflect.set(page, 'error', { message: 'private database diagnostics and token' });
			const result = render(RootError);
			expect(result.head).toContain('name="robots" content="noindex, nofollow"');
			expect(result.head).not.toContain('rel="canonical"');
			expect(result.body).toContain(locale === 'it' ? 'Pagina non trovata' : 'Page not found');
			expect(result.body).not.toContain('private database');
			expect(result.body).toContain('method="GET" action="/posts"');
			expect(result.body).toContain('name="search"');
			expect(result.body).toContain('for="missing-page-search"');
			expect(result.body).toContain('id="missing-page-search"');
			expect(result.body).toContain('href="/help"');
		}
	);

	it.each([400, 401, 403, 500, 503])(
		'handles status %i with safe, appropriate recovery',
		(status) => {
			const result = render(ErrorPage, { props: { status } });
			expect(result.body).toContain(`HTTP ${status}`);
			expect(result.body).not.toContain('name="search"');
			expect(result.head).toContain('noindex, nofollow');
			if (status === 401 || status === 403) {
				expect(result.body).toContain('href="/login"');
			} else {
				expect(result.body).toContain('Reload this page');
			}
		}
	);

	it.each([404, 500, 503])('marks %i responses as non-cacheable and non-indexable', (status) => {
		const response = secureResponse(new Response('error', { status }), {
			url: new URL('https://site.example.test/missing'),
			request: new Request('https://site.example.test/missing')
		});
		expect(response.status).toBe(status);
		expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
		expect(response.headers.get('cache-control')).toBe('no-store');
	});
});

describe('crawler discovery', () => {
	it('excludes private and recovery routes and uses the configured canonical origin', async () => {
		vi.stubEnv('SITE_URL', 'https://canonical.example.test');
		const response = await robotsGet({} as Parameters<typeof robotsGet>[0]);
		const text = await response.text();
		expect(response.headers.get('content-type')).toContain('text/plain');
		expect(text).toContain('Allow: /');
		for (const path of [
			'/admin',
			'/account',
			'/login',
			'/logout',
			'/register',
			'/forgot-password',
			'/reset-password',
			'/language',
			'/api/'
		]) {
			expect(text).toContain(`Disallow: ${path}\n`);
		}
		expect(text).toContain('Sitemap: https://canonical.example.test/sitemap.xml');
		expect(text).not.toContain('Disallow: /about');
	});

	it('includes every public static page exactly once and no private routes', async () => {
		vi.stubEnv('SITE_URL', 'https://canonical.example.test');
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ items: [], total: 0 }))
			.mockResolvedValueOnce(Response.json({ items: [] }));
		vi.stubGlobal('fetch', fetcher);
		const response = await sitemapGet({} as Parameters<typeof sitemapGet>[0]);
		const text = await response.text();
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('application/xml');
		const locations = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
		expect(locations).toEqual(
			PUBLIC_SITE_PATHS.map((path) => `https://canonical.example.test${path === '/' ? '' : path}`)
		);
		for (const path of [
			'/account',
			'/admin',
			'/register',
			'/login',
			'/forgot-password',
			'/reset-password'
		]) {
			expect(text).not.toContain(`<loc>https://canonical.example.test${path}`);
		}
	});

	it.each(['/about', '/help', '/privacy', '/cookies'])(
		'does not share localized %s HTML in public caches',
		(path) => {
			const url = new URL(path, 'https://site.example.test');
			const response = secureResponse(new Response('page'), { url, request: new Request(url) });
			expect(response.headers.get('cache-control')).toBe('private, no-store');
			expect(response.headers.get('vary')).toBe('Cookie');
			expect(response.headers.has('x-robots-tag')).toBe(false);
		}
	);

	it.each(['/forgot-password', '/reset-password', '/language', '/api/media/example'])(
		'keeps %s non-indexable even when successful',
		(path) => {
			const url = new URL(path, 'https://site.example.test');
			const response = secureResponse(new Response('page'), { url, request: new Request(url) });
			expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
			expect(response.headers.get('cache-control')).toBe('no-store');
		}
	);
});
