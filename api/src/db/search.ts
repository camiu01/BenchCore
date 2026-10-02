/**
 * @file search.ts
 * @brief In-memory approximation of PostgreSQL simple web-search queries.
 */
import type { PostRow } from './schema.js';

/**
 * @brief Extracts case-insensitive words without language stemming.
 * @param text The searchable text.
 * @return The normalized words.
 */
function words(text: string): string[] {
	return text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
}

/**
 * @brief Matches common web-search syntax: conjunctions, OR, exclusions and phrases.
 * @param row The post whose title, description and Markdown are searched.
 * @param search The search query.
 * @return Whether the post matches.
 */
export function matchesSearch(row: PostRow, search: string | undefined): boolean {
	if (search === undefined || search.trim() === '') { return true; }
	const document = words(`${row.title} ${row.description} ${row.contentMarkdown}`);
	const tokens = search.match(/-?"[^"]*"|-?[^\s"]+/g) ?? [];
	const groups: boolean[][] = [[]];
	for (const token of tokens) {
		if (token.toUpperCase() === 'OR') { groups.push([]); continue; }
		const excluded = token.startsWith('-');
		const term = excluded ? token.slice(1) : token;
		const queryWords = words(term);
		if (queryWords.length === 0) { continue; }
		const found = term.startsWith('"')
			? document.some((_, index) => queryWords.every((word, offset) => document[index + offset] === word))
			: queryWords.every((word) => document.includes(word));
		groups[groups.length - 1]!.push(excluded ? !found : found);
	}
	return groups.some((group) => group.length > 0 && group.every(Boolean));
}
