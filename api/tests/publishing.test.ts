/**
 * @file publishing.test.ts
 * @brief Unit tests for centralized publishing rules.
 */
import { describe, expect, it } from 'vitest';
import { canTransition, isPublic, normalizeSlug } from '../src/posts/publishing.js';

describe('isPublic', () => {
	it('shows only published posts past their date', () => {
		const past = new Date('2020-01-01T00:00:00Z');
		const future = new Date('2999-01-01T00:00:00Z');
		expect(isPublic('published', past, new Date())).toBe(true);
		expect(isPublic('published', future, new Date())).toBe(false);
		expect(isPublic('published', null, new Date())).toBe(false);
		expect(isPublic('draft', past, new Date())).toBe(false);
		expect(isPublic('archived', past, new Date())).toBe(false);
	});
});

describe('canTransition', () => {
	it('allows same-state saves and the documented flows', () => {
		expect(canTransition('draft', 'draft')).toBe(true);
		expect(canTransition('draft', 'published')).toBe(true);
		expect(canTransition('published', 'archived')).toBe(true);
		expect(canTransition('archived', 'published')).toBe(true);
	});
});

describe('normalizeSlug', () => {
	it('trims and lowercases slugs', () => {
		expect(normalizeSlug('  My-Post ')).toBe('my-post');
	});
});
