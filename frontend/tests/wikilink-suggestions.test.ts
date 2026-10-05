/**
 * @file wikilink-suggestions.test.ts
 * @brief Wikilink autocomplete query and filtering coverage.
 */
import { describe, expect, it } from 'vitest';
import {
	filterWikilinkSuggestions,
	findWikilinkQuery,
	wikilinkReplacementRange
} from '../src/lib/wikilink-suggestions.js';

describe('wikilink suggestions', () => {
	it('rejects stale cursor positions without replacing later paragraphs', () => {
		const value = '[[graph\n\nKeep this paragraph.';
		expect(wikilinkReplacementRange(value, value.length, value.length, 0)).toBeNull();
		expect(wikilinkReplacementRange('[[graph', 4, 7, 0)).toBeNull();
	});

	it('replaces existing closing brackets without duplicating them', () => {
		expect(wikilinkReplacementRange('See [[graph]] after', 11, 11, 4)).toEqual({
			start: 6,
			end: 13
		});
	});
	it('recognizes only an unfinished wikilink at the cursor', () => {
		expect(findWikilinkQuery('See [[graph', 11)).toEqual({ start: 4, query: 'graph' });
		expect(findWikilinkQuery('See [[graph]]', 13)).toBeNull();
		expect(findWikilinkQuery('See [[graph\nnext', 16)).toBeNull();
	});

	it('filters titles and slugs without case sensitivity', () => {
		const posts = [
			{ slug: 'system-design', title: 'System Design' },
			{ slug: 'graph-view', title: 'Knowledge Map' },
			{ slug: 'notes', title: 'Daily Notes' }
		];
		expect(filterWikilinkSuggestions(posts, 'GRAPH')).toEqual([posts[1]]);
		expect(filterWikilinkSuggestions(posts, 'design')).toEqual([posts[0]]);
	});
});
