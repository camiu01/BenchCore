/**
 * @file newsletter.test.ts
 * @brief Explicit consent UI, preview-only drafts and non-mutating email landing pages.
 */
import { render } from 'svelte/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Newsletter from '../src/routes/newsletter/+page.svelte';
import AdminNewsletter from '../src/routes/admin/newsletter/+page.svelte';
import { load } from '../src/routes/newsletter/[action]/+page.server.js';
import { secureResponse } from '../src/lib/server/security.js';

const base = {
	locale: 'en' as const,
	siteBase: 'https://example.test',
	sessionRole: null,
	directUploads: false,
	schedulerEnabled: false
};
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('newsletter consent UI', () => {
	it('requires an unchecked consent checkbox independently of accounts', () => {
		const { body } = render(Newsletter, { props: { data: { ...base, enabled: true } } });
		const checkbox = body.match(/<input[^>]*name="consent"[^>]*>/)?.[0] ?? '';
		expect(checkbox).toContain('required');
		expect(checkbox).not.toContain('checked');
		expect(body).toContain('Creating an account does not subscribe you');
		expect(body).toContain('href="/privacy"');
	});
	it('disables subscription when email delivery is unavailable', () => {
		const { body } = render(Newsletter, { props: { data: { ...base, enabled: false } } });
		expect(body).toContain('No newsletter emails can be sent');
		expect(body).toMatch(/<button[^>]*disabled/);
	});
	it('makes saving a draft explicitly separate from approving delivery', () => {
		const { body } = render(AdminNewsletter, {
			props: {
				data: {
					...base,
					user: null,
					dashboard: {
						enabled: false,
						confirmed: 0,
						items: []
					}
				}
			}
		});
		expect(body).toContain('Save preview without sending');
		expect(body).not.toContain('action="?/send"');
	});
	it('does not consume confirmation links on GET and suppresses token referrers', async () => {
		const fetcher = vi.fn();
		vi.stubGlobal('fetch', fetcher);
		const url = new URL(`https://example.test/newsletter/confirm?token=${'a'.repeat(43)}`);
		const result = await load({
			params: { action: 'confirm' },
			url,
			setHeaders: vi.fn()
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ action: 'confirm' });
		expect(fetcher).not.toHaveBeenCalled();
		const response = secureResponse(new Response(''), { url, request: new Request(url) });
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(response.headers.get('referrer-policy')).toBe('no-referrer');
	});
});
