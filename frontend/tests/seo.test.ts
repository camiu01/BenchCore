/**
 * @file seo.test.ts
 * @brief Server-rendered Open Graph and Twitter cards, escaped text and article dates.
 */
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Seo from '../src/lib/components/Seo.svelte';

describe('SSR social metadata', () => {
	it('includes canonical cards, cover and article timestamps before hydration', () => {
		const { head } = render(Seo, {
			props: {
				title: 'Circuits < signals',
				description: 'Research & measurements',
				canonical: 'https://canonical.example/posts/circuits',
				image: 'https://canonical.example/api/media/cover.png',
				publishedTime: '2026-01-01T00:00:00Z',
				modifiedTime: '2026-10-19T00:00:00Z'
			}
		});
		expect(head).toContain('property="og:type" content="article"');
		expect(head).toContain('property="og:title" content="Circuits &lt; signals"');
		expect(head).toContain('name="twitter:card" content="summary_large_image"');
		expect(head).toContain(
			'property="og:image" content="https://canonical.example/api/media/cover.png"'
		);
		expect(head).toContain(
			'name="twitter:image" content="https://canonical.example/api/media/cover.png"'
		);
		expect(head).toContain('property="article:published_time" content="2026-01-01T00:00:00Z"');
		expect(head).toContain('property="article:modified_time" content="2026-10-19T00:00:00Z"');
	});
	it('uses summary cards without fabricating images or article dates for tag archives', () => {
		const { head } = render(Seo, {
			props: {
				title: 'Engineering',
				description: 'Engineering posts',
				type: 'website',
				canonical: 'https://canonical.example/tags/engineering?page=2',
				publishedTime: '2026-01-01T00:00:00Z'
			}
		});
		expect(head).toContain('property="og:type" content="website"');
		expect(head).toContain('name="twitter:card" content="summary"');
		expect(head).toContain(
			'rel="canonical" href="https://canonical.example/tags/engineering?page=2"'
		);
		expect(head).not.toContain('og:image');
		expect(head).not.toContain('article:published_time');
	});
});
