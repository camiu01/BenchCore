/**
 * @file wikilink-suggestions.ts
 * @brief Cursor-aware helpers for post wikilink autocomplete.
 */
import { fuzzyScore } from './fuzzy-match.js';
export interface WikilinkSuggestion {
	slug: string;
	title: string;
	tags?: string[];
}

export interface WikilinkQuery {
	start: number;
	query: string;
}

/**
 * @brief Finds an unfinished wikilink immediately before the cursor.
 * @param value Complete editor value.
 * @param cursor Current cursor offset.
 * @return Active query and opening offset, or null.
 */
export function findWikilinkQuery(value: string, cursor: number): WikilinkQuery | null {
	const prefix = value.slice(0, cursor);
	const start = prefix.lastIndexOf('[[');
	if (start < 0) return null;
	const query = prefix.slice(start + 2);
	return /[\]\n]/.test(query) ? null : { start, query };
}

/**
 * @brief Validates an autocomplete replacement against the current cursor.
 * @param value Live editor text.
 * @param start Current selection start.
 * @param end Current selection end.
 * @param opening Opening offset captured when suggestions were shown.
 * @return Safe replacement bounds, or null for stale suggestions.
 */
export function wikilinkReplacementRange(
	value: string,
	start: number,
	end: number,
	opening: number
): { start: number; end: number } | null {
	const active = findWikilinkQuery(value, start);
	if (start !== end || active?.start !== opening) return null;
	return {
		start: opening + 2,
		end: value.slice(start, start + 2) === ']]' ? start + 2 : start
	};
}

/** @brief Applies a cursor-validated wikilink without losing surrounding edits. @param input Live textarea. @param slug Selected post. @param opening Captured opening offset. @return Whether inserted. */
export function insertEditorWikilink(
	input: HTMLTextAreaElement,
	slug: string,
	opening: number
): boolean {
	const range = wikilinkReplacementRange(
		input.value,
		input.selectionStart,
		input.selectionEnd,
		opening
	);
	if (!range) return false;
	input.setRangeText(`${slug}]]`, range.start, range.end, 'end');
	input.dispatchEvent(new Event('input', { bubbles: true }));
	input.focus();
	return true;
}

/**
 * @brief Ranks and caps fuzzy suggestions by title, slug and tags.
 * @param suggestions Available posts.
 * @param query Current text after the opening brackets.
 * @return At most eight matching posts.
 */
export function filterWikilinkSuggestions(
	suggestions: WikilinkSuggestion[],
	query: string
): WikilinkSuggestion[] {
	return suggestions
		.map((post, index) => ({
			post,
			index,
			score: Math.min(
				fuzzyScore(post.title, query),
				fuzzyScore(post.slug, query) + 0.1,
				...(post.tags ?? []).slice(0, 20).map((tag) => fuzzyScore(tag, query) + 0.2)
			)
		}))
		.filter((entry) => Number.isFinite(entry.score))
		.sort((a, b) => a.score - b.score || a.index - b.index)
		.slice(0, 8)
		.map((entry) => entry.post);
}
