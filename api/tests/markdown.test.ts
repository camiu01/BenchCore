/**
 * @file markdown.test.ts
 * @brief Unit tests for frontmatter splitting, validation and rendering.
 */
import { describe, expect, it } from 'vitest';
import { parseTomlBlock, splitFrontmatter } from '../src/markdown/frontmatter.js';
import { renderMarkdown } from '../src/markdown/render.js';
import { validateFrontmatter } from '../src/markdown/schema.js';

const EXAMPLE = `+++
title = "My First Post"
slug = "my-first-post"
description = "My first blog post."
status = "draft"
tags = ["typescript", "web"]
published_at = "2026-10-01T18:00:00Z"
+++

# My First Post

This is the content of the post.
`;

describe('splitFrontmatter', () => {
	it('splits TOML from the Markdown body', () => {
		const result = splitFrontmatter(EXAMPLE, 'example.md');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.toml).toContain('title = "My First Post"');
			expect(result.body).toContain('# My First Post');
		}
	});

	it('rejects sources without fences', () => {
		const result = splitFrontmatter('# No fences\n', 'plain.md');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issue.kind).toBe('missing-fences');
		}
	});

	it('rejects unclosed fences', () => {
		const result = splitFrontmatter('+++\ntitle = "x"\n', 'open.md');
		expect(result.ok).toBe(false);
	});

	it('rejects empty TOML blocks', () => {
		const result = splitFrontmatter('+++\n+++\nbody\n', 'empty.md');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issue.kind).toBe('empty-toml');
		}
	});
});

describe('parseTomlBlock', () => {
	it('parses valid TOML', () => {
		const result = parseTomlBlock('title = "x"', 'ok.md');
		expect(result.ok).toBe(true);
	});

	it('reports TOML syntax errors', () => {
		const result = parseTomlBlock('title = = "x"', 'bad.md');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issue.kind).toBe('toml-error');
		}
	});
});

describe('validateFrontmatter', () => {
	it('accepts the example frontmatter with defaults', () => {
		const split = splitFrontmatter(EXAMPLE, 'example.md');
		if (!split.ok) {
			throw new Error('example must split');
		}
		const toml = parseTomlBlock(split.toml, 'example.md');
		if (!toml.ok) {
			throw new Error('example must parse');
		}
		const validated = validateFrontmatter(toml.data);
		expect(validated.ok).toBe(true);
		if (validated.ok) {
			expect(validated.value.slug).toBe('my-first-post');
			expect(validated.value.tags).toEqual(['typescript', 'web']);
		}
	});

	it('applies defaults for missing optional fields', () => {
		const validated = validateFrontmatter({ title: 'T', slug: 't' });
		expect(validated.ok).toBe(true);
		if (validated.ok) {
			expect(validated.value.status).toBe('draft');
			expect(validated.value.tags).toEqual([]);
			expect(validated.value.description).toBe('');
		}
	});

	it('rejects bad slugs and missing titles', () => {
		expect(validateFrontmatter({ title: 'T', slug: 'Bad Slug!' }).ok).toBe(false);
		expect(validateFrontmatter({ slug: 't' }).ok).toBe(false);
	});
});

describe('renderMarkdown', () => {
	it('renders headings and paragraphs', async () => {
		const rendered = await renderMarkdown('# Hi\n\nHello.');
		expect(rendered.html).toContain('<h1>Hi</h1>');
		expect(rendered.readingMinutes).toBe(1);
		expect(rendered.links).toEqual([]);
	});

	it('strips scripts and javascript: links', async () => {
		const rendered = await renderMarkdown('<script>alert(1)</script>\n\n[x](javascript:alert(1))');
		expect(rendered.html).not.toContain('<script>');
		expect(rendered.html).not.toContain('javascript:');
	});

	it('resolves wikilinks to post anchors', async () => {
		const rendered = await renderMarkdown('See [[my-first-post]] and [[other|Other label]].');
		expect(rendered.html).toContain('<a href="/posts/my-first-post" class="wikilink">my-first-post</a>');
		expect(rendered.html).toContain('<a href="/posts/other" class="wikilink">Other label</a>');
		expect(rendered.links).toEqual(['my-first-post', 'other']);
	});

	it('marks unknown wikilinks as broken when slugs are known', async () => {
		const rendered = await renderMarkdown('See [[ghost]].', { knownSlugs: new Set(['real']) });
		expect(rendered.html).toContain('class="wikilink broken"');
		const clean = await renderMarkdown('See [[real]].', { knownSlugs: new Set(['real']) });
		expect(clean.html).not.toContain('broken');
	});

	it('prefixes relative image sources with the media prefix', async () => {
		const rendered = await renderMarkdown('![alt](pic.png)', { mediaPrefix: '/api/media' });
		expect(rendered.html).toContain('src="/api/media/pic.png"');
		const absolute = await renderMarkdown('![alt](https://example.com/pic.png)', {
			mediaPrefix: '/api/media'
		});
		expect(absolute.html).toContain('src="https://example.com/pic.png"');
	});
});
