/**
 * @file post-outline.test.ts
 * @brief Stable, safe heading IDs and escaped table-of-contents labels.
 */
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { postOutline } from '../src/lib/post-outline.js';
import PostOutline from '../src/lib/components/PostOutline.svelte';

describe('post outline', () => {
	it('creates unique stable anchors for duplicate and non-Latin headings', () => {
		const html = '<h2>Setup</h2><p>Body.</p><h3>Setup</h3><h2>日本語</h2>';
		const outline = postOutline(html);
		expect(outline.headings.map((heading) => heading.id)).toEqual([
			'post-section-1',
			'post-section-2',
			'post-section-3'
		]);
		expect(outline.html).toContain('<h3 id="post-section-2">Setup</h3>');
		expect(outline.html).toContain('<p>Body.</p>');
		expect(postOutline(html)).toEqual(outline);
	});

	it('uses plain-text labels without introducing executable HTML', () => {
		const outline = postOutline(
			'<h2><em>A &amp; B</em></h2><h3>&lt;img src=x onerror=alert(1)&gt;</h3><h4>&#x1F600; &#0;</h4>'
		);
		expect(outline.headings[0]?.title).toBe('A & B');
		expect(outline.headings[2]?.title).toBe('😀 �');
		const { body } = render(PostOutline, { props: { headings: outline.headings } });
		expect(body).toContain('href="#post-section-2"');
		expect(body).toContain('&lt;img');
		expect(body).not.toContain('<img');
	});

	it('omits navigation for short posts and preserves unheaded content', () => {
		const short = postOutline('<h2>Only section</h2><p>Text</p>');
		expect(render(PostOutline, { props: { headings: short.headings } }).body).not.toContain('<nav');
		expect(postOutline('<p>No sections.</p>')).toEqual({
			html: '<p>No sections.</p>',
			headings: []
		});
	});
});
