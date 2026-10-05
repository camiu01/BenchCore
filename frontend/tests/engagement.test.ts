/**
 * @file engagement.test.ts
 * @brief Public post engagement markup and moderation-safe controls.
 */
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import PostEngagement from '../src/lib/components/PostEngagement.svelte';

describe('post engagement', () => {
	it('renders accessible like and moderated comment controls', () => {
		const result = render(PostEngagement, { props: { slug: 'example-post' } });
		expect(result.body).toContain('LIKE');
		expect(result.body).toContain('SUBMIT FOR REVIEW');
		expect(result.body).toContain('name="authorName"');
		expect(result.body).toContain('name="content"');
		expect(result.body).toContain('No approved comments yet.');
	});
});
