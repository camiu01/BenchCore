/**
 * @file i18n.test.ts
 * @brief Language negotiation, catalog integrity, request propagation and the language endpoint.
 */
import { render } from 'svelte/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { en, it as italian } from '../src/lib/i18n/messages/index.js';
import { intlTag, isLocale, parseAcceptLanguage, resolveLocale } from '../src/lib/i18n/locale.js';
import { translate, translator } from '../src/lib/i18n/translate.js';
import { navigationLabel, publicationDate } from '../src/lib/presentation.js';
import { authenticationLink } from '../src/lib/navigation.js';
import { safeLocalPath } from '../src/lib/server/local-path.js';
import { requestLocale, runWithLocale } from '../src/lib/server/request-locale.js';
import { serverT } from '../src/lib/server/server-t.js';
import { apiFetch } from '../src/lib/server/transport.js';
import { handle } from '../src/hooks.server.js';
import { POST as languagePost } from '../src/routes/language/+server.js';
import DocShell from '../src/lib/components/DocShell.svelte';
import { setTestLocale } from './support/locale.js';

afterEach(() => {
	setTestLocale('en');
	vi.unstubAllGlobals();
});

describe('language negotiation', () => {
	it('honors quality weights and regional tags', () => {
		expect(parseAcceptLanguage('fr;q=0.9, it-IT;q=0.8, en;q=0.5')).toBe('it');
		expect(parseAcceptLanguage('en-GB,it;q=0.9')).toBe('en');
		expect(parseAcceptLanguage('fr, de;q=0.5')).toBeNull();
		expect(parseAcceptLanguage('it;q=0')).toBeNull();
		expect(parseAcceptLanguage(null)).toBeNull();
	});

	it('prefers the cookie, then the browser, then English', () => {
		expect(resolveLocale('it', 'en')).toBe('it');
		expect(resolveLocale('xx', 'it-IT')).toBe('it');
		expect(resolveLocale(undefined, undefined)).toBe('en');
		expect(isLocale('it')).toBe(true);
		expect(isLocale('de')).toBe(false);
		expect(intlTag('it')).toBe('it-IT');
	});
});

describe('message catalogs', () => {
	it('keeps every Italian message complete and placeholder-compatible', () => {
		const holes = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join();
		for (const [key, text] of Object.entries(en)) {
			const translated = (italian as Record<string, string>)[key];
			expect(translated, key).toBeTruthy();
			expect(holes(translated ?? ''), key).toBe(holes(text));
		}
		expect(Object.keys(italian).sort()).toEqual(Object.keys(en).sort());
	});

	it('interpolates placeholders and leaves unknown ones visible', () => {
		expect(translate('en', 'lang.switchTo', { name: 'Italiano' })).toBe(
			'Switch language to Italiano'
		);
		expect(translate('it', 'lang.switchTo', { name: 'English' })).toBe('Cambia lingua in English');
		expect(translate('en', 'lang.switchTo')).toBe('Switch language to {name}');
		expect(translator('it')('nav.posts')).toBe('Articoli');
	});

	it('localizes navigation labels, auth links and dates', () => {
		expect(navigationLabel('/posts', 'x', 'it')).toBe('Articoli');
		expect(navigationLabel('/custom', 'Custom', 'it')).toBe('Custom');
		expect(authenticationLink('admin', '04', 'it').label).toBe('[04] admin');
		expect(authenticationLink(null, '05', 'it').label).toBe('[05] accesso');
		expect(publicationDate('2026-10-06T00:30:00Z', 'it')).toBe('6 ottobre 2026');
		expect(publicationDate(null, 'it')).toBe('Data non disponibile');
	});
});

describe('request language propagation', () => {
	it('exposes the request language to server messages only inside a request', () => {
		expect(requestLocale()).toBeUndefined();
		expect(serverT('nav.posts')).toBe('Posts');
		runWithLocale('it', () => expect(serverT('nav.posts')).toBe('Articoli'));
	});

	it('forwards the language to the API without overriding an explicit header', async () => {
		const fetcher = vi.fn().mockResolvedValue(Response.json({}));
		vi.stubGlobal('fetch', fetcher);
		await runWithLocale('it', () => apiFetch('http://api.test/x', { headers: { cookie: 'a=b' } }));
		await runWithLocale('it', () =>
			apiFetch('http://api.test/y', { headers: { 'accept-language': 'en' } })
		);
		await apiFetch('http://api.test/z');
		const sent = fetcher.mock.calls.map((call) =>
			new Headers(call[1]?.headers).get('accept-language')
		);
		expect(sent).toEqual(['it', 'en', null]);
	});

	it('sets locals and the document language in the hook', async () => {
		const url = new URL('http://localhost:5173/');
		const event = {
			url,
			locals: { user: null },
			cookies: { get: (name: string) => (name === 'lang' ? 'it' : undefined) },
			request: new Request(url, { headers: { 'accept-language': 'en' } })
		} as unknown as Parameters<typeof handle>[0]['event'];
		let transformed = '';
		const resolve = vi.fn(async (_event, options) => {
			transformed = options.transformPageChunk({
				html: '<html lang="en" data-theme="light">',
				done: true
			});
			return new Response('ok');
		});
		await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
		expect(event.locals.locale).toBe('it');
		expect(transformed).toBe('<html lang="it" data-theme="light">');
	});
});

describe('language endpoint', () => {
	/**
	 * @brief Posts the language form to the endpoint.
	 * @param fields Form fields.
	 * @return Redirect response and the cookie writer.
	 */
	async function choose(fields: Record<string, string>) {
		const url = new URL('https://example.test/language');
		const body = new URLSearchParams(fields);
		const cookies = { set: vi.fn() };
		const request = new Request(url, { method: 'POST', body });
		const thrown = await Promise.resolve()
			.then(() =>
				languagePost({ request, cookies, url } as unknown as Parameters<typeof languagePost>[0])
			)
			.catch((cause: unknown) => cause as { status: number; location: string });
		return { thrown, cookies };
	}

	it('stores the choice for a year and returns to the same local page', async () => {
		const { thrown, cookies } = await choose({ lang: 'it', return: '/posts?tag=a&sort=title' });
		expect(thrown).toMatchObject({ status: 303, location: '/posts?tag=a&sort=title' });
		expect(cookies.set).toHaveBeenCalledWith(
			'lang',
			'it',
			expect.objectContaining({
				path: '/',
				maxAge: 31_536_000,
				sameSite: 'lax',
				httpOnly: true,
				secure: true
			})
		);
	});

	it('falls back to English and never redirects off site', async () => {
		const { thrown, cookies } = await choose({ lang: 'de', return: 'https://evil.example/' });
		expect(thrown).toMatchObject({ status: 303, location: '/' });
		expect(cookies.set.mock.calls[0]?.[1]).toBe('en');
		for (const unsafe of [
			'//evil.example',
			'/\\evil.example',
			'javascript:alert(1)',
			`/${'a'.repeat(400)}`
		]) {
			expect(safeLocalPath(unsafe)).toBe('/');
		}
		expect(safeLocalPath('/tags/a?x=1')).toBe('/tags/a?x=1');
	});
});

describe('shell rendering', () => {
	const props = {
		docId: 'DOC',
		title: 'Title',
		sub: 'Sub',
		nav: [{ href: '/posts', label: '[02] posts' }],
		footerLeft: 'L',
		footerRight: 'R',
		children: (() => undefined) as never
	};

	it('renders English by default with a language switch', () => {
		const { body } = render(DocShell, { props });
		expect(body).toContain('Skip to content');
		expect(body).toContain('action="/language"');
		expect(body).toContain('>Posts<');
	});

	it('renders Italian when the page language is Italian', () => {
		setTestLocale('it');
		const { body } = render(DocShell, { props });
		expect(body).toContain('Vai al contenuto');
		expect(body).toContain('>Articoli<');
		expect(body).toContain('aria-pressed="true"');
	});
});
