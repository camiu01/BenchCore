/**
 * @file wikilink-suggestions.ts
 * @brief Cursor-aware helpers for post wikilink autocomplete.
 */
export interface WikilinkSuggestion {
	slug: string;
	title: string;
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
 * @brief Filters and caps suggestions by title or slug.
 * @param suggestions Available posts.
 * @param query Current text after the opening brackets.
 * @return At most eight matching posts.
 */
export function filterWikilinkSuggestions(
	suggestions: WikilinkSuggestion[],
	query: string
): WikilinkSuggestion[] {
	const needle = query.trim().toLowerCase();
	return suggestions
		.filter(
			(post) =>
				post.slug.toLowerCase().includes(needle) || post.title.toLowerCase().includes(needle)
		)
		.slice(0, 8);
}
