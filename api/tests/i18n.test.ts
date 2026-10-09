/**
 * @file i18n.test.ts
 * @brief Language negotiation and localized API messages.
 */
import type { IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiMessage, parseAcceptLanguage, renderMessage, requestLocale } from '../src/i18n/index.js';
import { apiMessages } from '../src/i18n/messages.js';
import { createHandler, startServer } from '../src/server.js';
import { createTestDeps, createTestRepos } from './helpers.js';

/**
 * @brief Builds the minimal request shape used by language negotiation.
 * @param headers Request headers.
 * @return A request double.
 */
function fakeRequest(headers: Record<string, string>): IncomingMessage {
	return { headers } as unknown as IncomingMessage;
}

describe('API language negotiation', () => {
	it('honors quality weights and regional tags', () => {
		expect(parseAcceptLanguage('fr;q=0.9, it-IT;q=0.8, en;q=0.5')).toBe('it');
		expect(parseAcceptLanguage('en-GB,it;q=0.9')).toBe('en');
		expect(parseAcceptLanguage('fr, de;q=0.5')).toBeNull();
		expect(parseAcceptLanguage('it;q=0')).toBeNull();
		expect(parseAcceptLanguage(undefined)).toBeNull();
	});

	it('prefers the language cookie, then the header, then English', () => {
		expect(requestLocale(fakeRequest({ cookie: 'lang=it', 'accept-language': 'en' }))).toBe('it');
		expect(requestLocale(fakeRequest({ cookie: 'lang=xx', 'accept-language': 'it' }))).toBe('it');
		expect(requestLocale(fakeRequest({}))).toBe('en');
	});

	it('fills placeholders in both languages', () => {
		expect(renderMessage('en', 'post.slug_exists', { slug: 'a-b' })).toBe('slug already exists: a-b');
		expect(renderMessage('it', 'post.slug_exists', { slug: 'a-b' })).toBe('Lo slug esiste già: a-b');
		expect(apiMessage(fakeRequest({ 'accept-language': 'it' }), 'auth.invalid_credentials')).toBe(
			'Credenziali non valide'
		);
	});

	it('keeps Italian placeholders identical to English ones', () => {
		for (const entry of Object.values(apiMessages)) {
			const holes = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join();
			expect(holes(entry.it)).toBe(holes(entry.en));
		}
	});
});

describe('localized HTTP responses', () => {
	let server: Server;
	let base = '';

	beforeEach(async () => {
		server = startServer(0, createHandler(createTestDeps(createTestRepos())), '127.0.0.1');
		await new Promise<void>((resolve) => server.once('listening', resolve));
		base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});
	afterEach(async () => {
		await new Promise<void>((resolve) => server.close(() => resolve()));
	});

	/**
	 * @brief Posts wrong credentials with a chosen language header.
	 * @param language Accept-Language value.
	 * @return The parsed error payload.
	 */
	async function failedLogin(language: string | undefined) {
		const response = await fetch(`${base}/api/auth/login`, {
			method: 'POST',
			headers: {
				origin: 'http://localhost:5173',
				'content-type': 'application/json',
				...(language === undefined ? {} : { 'accept-language': language })
			},
			body: JSON.stringify({ username: 'nobody', password: 'wrong-password' })
		});
		return (await response.json()) as { error: string; message: string };
	}

	it('answers in the requested language and keeps the machine code stable', async () => {
		expect(await failedLogin('it-IT,it;q=0.9')).toEqual({
			error: 'unauthorized',
			message: 'Credenziali non valide'
		});
		expect(await failedLogin(undefined)).toEqual({
			error: 'unauthorized',
			message: 'invalid credentials'
		});
	});
});
