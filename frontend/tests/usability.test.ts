/**
 * @file usability.test.ts
 * @brief Plain-language navigation, publication dates and reader recovery paths.
 */
import { render } from 'svelte/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigationLabel, publicationDate } from '../src/lib/presentation.js';
import Posts from '../src/routes/posts/+page.svelte';
import Topics from '../src/routes/tags/+page.svelte';
import Register from '../src/routes/register/+page.svelte';
import Login from '../src/routes/login/+page.svelte';
import AdminTags from '../src/routes/admin/tags/+page.svelte';
import { actions as loginActions } from '../src/routes/login/+page.server.js';

afterEach(() => {
	vi.unstubAllGlobals();
});

const base = {
	siteBase: 'https://example.test',
	sessionRole: null,
	directUploads: false,
	schedulerEnabled: false
};
const posts = {
	...base,
	items: [],
	total: 0,
	page: 1,
	totalPages: 1,
	perPage: 20,
	search: 'missing',
	online: true
};

describe('reader usability', () => {
	it('uses recognizable destination names while keeping custom navigation labels', () => {
		expect(navigationLabel('/posts', '[02] records')).toBe('Posts');
		expect(navigationLabel('/graph?focus=alpha', '[04] graph')).toBe('Connections');
		expect(navigationLabel('/custom', 'Custom destination')).toBe('Custom destination');
	});

	it('formats dates without depending on the browser time zone', () => {
		expect(publicationDate('2026-10-06T00:30:00Z')).toBe('6 October 2026');
		expect(publicationDate(null)).toBe('Date unavailable');
		expect(publicationDate('invalid')).toBe('Date unavailable');
	});

	it('offers search recovery and a shared keyboard skip link', () => {
		const { body } = render(Posts, { props: { data: posts } });
		expect(body).toContain('No matching posts');
		expect(body).toContain('Show all posts');
		expect(body).toContain('Skip to content');
		expect(body).toContain('id="main-content"');
		expect(body).toContain('aria-label="Main navigation"');
		expect(body).not.toContain('[01] index');
	});

	it('explains service errors without asking readers to run developer commands', () => {
		const { body } = render(Posts, { props: { data: { ...posts, online: false } } });
		expect(body).toContain('Try again');
		expect(body).not.toContain('pnpm dev:api');
	});

	it('offers an alternative when there are no topics', () => {
		const { body } = render(Topics, { props: { data: { ...base, items: [], online: true } } });
		expect(body).toContain('There are no topics yet');
		expect(body).toContain('Browse posts');
	});

	it('renders topics as direct navigation cards with post counts', () => {
		const { body } = render(Topics, {
			props: {
				data: {
					...base,
					online: true,
					items: [
						{ name: 'Embedded systems', slug: 'embedded-systems', color: '#2563EB', count: 2 }
					]
				}
			}
		});
		expect(body).toContain('aria-label="Topics"');
		expect(body).toContain('/tags/Embedded%20systems');
		expect(body).toContain('2 posts');
	});

	it('distinguishes an empty admin tag list from a service failure', () => {
		const data = { ...base, user: null, items: [], online: true, notice: null };
		const empty = render(AdminTags, { props: { data, form: null } });
		expect(empty.body).toContain('Add tags while creating or editing a post');
		const offline = render(AdminTags, { props: { data: { ...data, online: false }, form: null } });
		expect(offline.body).toContain('role="alert"');
		expect(offline.body).toContain('Try again');
		expect(offline.body).not.toContain('No tags yet');
	});

	it('shows registration requirements next to the fields and a sign-in alternative', () => {
		const { body } = render(Register, { props: { data: base, form: null } });
		expect(body).toContain('aria-describedby="username-help"');
		expect(body).toContain('Start with a letter');
		expect(body).toContain('at least 8 characters');
		expect(body).toContain('Already have an account?');
	});

	it('announces sign-in errors to assistive technology', () => {
		const { body } = render(Login, {
			props: {
				data: { ...base, next: null, notice: null },
				form: { error: 'Sign-in failed', email: '' }
			}
		});
		expect(body).toContain('role="alert"');
		expect(body).toContain('Sign-in failed');
	});

	it('gives readers a useful sign-in recovery message during API downtime', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
		const action = loginActions['login'];
		if (!action) throw new Error('Missing login action');
		const body = new FormData();
		body.set('email', 'reader@example.test');
		body.set('password', 'example-only-password');
		const result = await action({
			request: new Request('https://example.test/login?/login', { method: 'POST', body })
		} as Parameters<typeof action>[0]);
		expect(result).toMatchObject({
			status: 503,
			data: { error: 'Sign-in is temporarily unavailable. Please try again in a moment.' }
		});
		expect(JSON.stringify(result)).not.toContain('pnpm');
	});
});
