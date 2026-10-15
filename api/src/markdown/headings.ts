/**
 * @file headings.ts
 * @brief Safe semantic heading anchors shared by rendered sections and wikilink fragments.
 */
const namedEntities: Record<string, string> = {
	amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '
};

/**
 * @brief Derives plain heading text from sanitized HTML, excluding hidden math annotations.
 * @param html Sanitized heading contents.
 * @return Decoded plain text.
 */
function headingText(html: string): string {
	return html.replace(/<annotation\b[^>]*>[\s\S]*?<\/annotation>/g, '').replace(/<[^>]*>/g, '')
		.replace(/&(?:#(\d+)|#x([a-f0-9]+)|(amp|lt|gt|quot|apos|nbsp));/gi,
			(entity: string, decimal: string | undefined, hex: string | undefined, named: string | undefined) => {
				if (named) { return namedEntities[named.toLowerCase()] ?? entity; }
				const point = Number.parseInt(decimal ?? hex ?? '', decimal ? 10 : 16);
				return point > 0 && point <= 0x10ffff && (point < 0xd800 || point > 0xdfff)
					? String.fromCodePoint(point) : '\uFFFD';
			});
}

/**
 * @brief Normalizes a section title or fragment without allowing HTML attribute syntax.
 * @param text Plain section title.
 * @return Safe deterministic ID.
 */
export function sectionId(text: string): string {
	const id = text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 180).replace(/^-|-$/g, '') || 'section';
	return /^post-section(?:-\d+)?$/.test(id) ? `heading-${id}` : id;
}

/**
 * @brief Anchors sanitized headings with unique IDs and retains legacy numeric deep links.
 * @param html Sanitized rendered HTML.
 * @return HTML containing semantic heading IDs and legacy aliases.
 */
export function anchorHeadings(html: string): string {
	const used = new Set<string>();
	let index = 0;
	return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_match, level: string, content: string) => {
		const base = sectionId(headingText(content));
		let id = base;
		let suffix = 1;
		while (used.has(id)) { id = `${base}-${++suffix}`; }
		used.add(id);
		index += 1;
		return `<h${level} id="${id}"><span id="post-section-${index}" aria-hidden="true"></span>${content}</h${level}>`;
	});
}
