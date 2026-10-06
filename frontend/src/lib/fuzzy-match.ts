/**
 * @file fuzzy-match.ts
 * @brief Bounded accent-insensitive ranking with subsequences and small spelling errors.
 */

/** @brief Normalizes search text consistently. @param value Text. @return Lowercase accent-free text. */
function normalized(value: string): string {
	return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** @brief Computes at most two edits using bounded rolling rows. @param word Candidate word. @param query Query word. @return Distance or infinity outside the tolerance. */
function editDistance(word: string, query: string): number {
	if (Math.abs(word.length - query.length) > 2) return Infinity;
	let previous = Array.from({ length: query.length + 1 }, (_, index) => index);
	for (let row = 1; row <= word.length; row++) {
		const current = [row];
		for (let col = 1; col <= query.length; col++) {
			current[col] = Math.min(
				current[col - 1]! + 1,
				previous[col]! + 1,
				previous[col - 1]! + (word[row - 1] === query[col - 1] ? 0 : 1)
			);
		}
		if (Math.min(...current) > 2) return Infinity;
		previous = current;
	}
	return previous[query.length]!;
}

/** @brief Ranks exact, prefix, substring, subsequence and typo matches, in that order. @param candidate Title, slug or tag. @param input Search text. @return Lower is better; infinity means no match. */
export function fuzzyScore(candidate: string, input: string): number {
	const text = normalized(candidate.slice(0, 200));
	const query = normalized(input.slice(0, 80));
	if (!query) return 0;
	if (text === query) return 0;
	if (text.startsWith(query)) return 1;
	if (text.includes(query)) return 2;
	if (query.length < 3) return Infinity;
	let cursor = 0,
		matched = 0;
	for (const character of query) {
		cursor = text.indexOf(character, cursor);
		if (cursor < 0) {
			matched = 0;
			break;
		}
		cursor++;
		matched++;
	}
	if (matched === query.length) return 4 + (cursor - query.length) / Math.max(text.length, 1);
	const words = text
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean)
		.slice(0, 30);
	const tolerance = query.length < 6 ? 1 : 2;
	const distance = Math.min(...words.map((word) => editDistance(word, query)));
	return distance <= tolerance ? 6 + distance : Infinity;
}
