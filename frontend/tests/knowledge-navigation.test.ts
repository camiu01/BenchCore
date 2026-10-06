/**
 * @file knowledge-navigation.test.ts
 * @brief Fuzzy ranking and shareable archive filters preserve bounded reader behavior.
 */
import { describe, expect, it } from 'vitest';
import { archiveHref, archiveQuery, archiveSortLabel } from '../src/lib/posts-query.js';
import { filterWikilinkSuggestions } from '../src/lib/wikilink-suggestions.js';

describe('knowledge navigation helpers', () => {
	it('finds titles, slug abbreviations, accented titles and misspelled tags', () => {
		const posts = [
			{ slug: 'typescript', title: 'TypeScript' },
			{ slug: 'storage', title: 'Storage guide', tags: ['database'] },
			{ slug: 'coffee', title: 'Café' }
		];
		expect(filterWikilinkSuggestions(posts, 'typscrpt')).toEqual([posts[0]]);
		expect(filterWikilinkSuggestions(posts, 'datbase')).toEqual([posts[1]]);
		expect(filterWikilinkSuggestions(posts, 'cafe')).toEqual([posts[2]]);
		expect(filterWikilinkSuggestions(posts, 'TypeScript')[0]).toBe(posts[0]);
		expect(filterWikilinkSuggestions(posts, 'totallyunrelated')).toEqual([]);
	});

	it('preserves AND/OR, tags and sorting on pagination and escapes hostile labels', () => {
		const query = archiveQuery(
			new URLSearchParams(
				'tag=web+dev&tag=security&tag=security&tagMode=or&sort=popular&search=hello'
			)
		);
		const href = archiveHref(query, 3);
		expect(href).toBe(
			'/posts?page=3&search=hello&tag=web+dev&tag=security&tagMode=or&sort=popular'
		);
		expect(archiveQuery(new URL(href, 'https://example.test').searchParams)).toEqual({
			...query,
			page: 3
		});
		expect(archiveHref({ ...query, tags: ['<script>'] })).not.toContain('<script>');
		expect(archiveSortLabel('updated')).toBe('recently updated first');
		expect(archiveQuery(new URLSearchParams('page=99999999&sort=evil&tagMode=x')).page).toBe(1);
	});
});
