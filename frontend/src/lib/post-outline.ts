/**
 * @file post-outline.ts
 * @brief Stable heading anchors and plain-text navigation for already sanitized post HTML.
 */
export interface PostHeading {
	id: string;
	title: string;
	level: number;
}
const entities: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' '
};

/** @brief Decodes heading text for escaped Svelte rendering, never for HTML insertion. @param html Sanitized heading contents. @return Plain text label. */
function headingText(html: string): string {
	return html
		.replace(/<[^>]*>/g, '')
		.replace(
			/&(?:#(\d+)|#x([a-f0-9]+)|(amp|lt|gt|quot|apos|nbsp));/gi,
			(
				entity: string,
				decimal: string | undefined,
				hex: string | undefined,
				named: string | undefined
			) => {
				if (named) return entities[named.toLowerCase()] ?? entity;
				const point = Number.parseInt(decimal ?? hex ?? '', decimal ? 10 : 16);
				return point > 0 && point <= 0x10ffff && (point < 0xd800 || point > 0xdfff)
					? String.fromCodePoint(point)
					: '\uFFFD';
			}
		)
		.replace(/\s+/g, ' ')
		.trim();
}

/** @brief Adds fixed safe IDs without reinterpreting Markdown or altering sanitized content. @param sanitizedHtml Trusted API-sanitized HTML. @return Anchored HTML and outline. */
export function postOutline(sanitizedHtml: string): { html: string; headings: PostHeading[] } {
	const headings: PostHeading[] = [];
	const html = sanitizedHtml.replace(
		/<h([1-4])>([\s\S]*?)<\/h\1>/g,
		(_match: string, level: string, content: string) => {
			const id = `post-section-${headings.length + 1}`;
			headings.push({
				id,
				title: headingText(content) || `Section ${headings.length + 1}`,
				level: Number(level)
			});
			return `<h${level} id="${id}">${content}</h${level}>`;
		}
	);
	return { html, headings };
}
