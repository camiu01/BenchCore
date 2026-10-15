/**
 * @file render.ts
 * @brief Markdown rendering: Obsidian-style [[wikilinks]], sanitized HTML, metadata.
 */
import { parseMathMarkdown } from './math.js';
import sanitizeHtml from 'sanitize-html';
import { anchorHeadings, sectionId } from './headings.js';

/**
 * @brief Options controlling Markdown rendering.
 */
export interface RenderOptions {
	mediaPrefix?: string | undefined;
	knownSlugs?: Set<string> | undefined;
}

/**
 * @brief Rendered post content plus extracted metadata.
 */
export interface RenderedContent {
	html: string;
	excerpt: string;
	readingMinutes: number;
	links: string[];
}

/** Matches Obsidian-style [[slug]] and [[slug|label]] links. */
const WIKILINK_PATTERN = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

/** Matches relative image sources (leaves http:, data: and absolute paths alone). */
const RELATIVE_IMG_PATTERN = /<img([^>]*?)src="(?!https?:|data:|\/)([^"]+)"([^>]*?)>/g;

/**
 * @brief Extracts wikilink target slugs from Markdown source.
 * @param markdown The Markdown source.
 * @return The referenced slugs in order of appearance.
 */
export function extractWikiLinks(markdown: string): string[] {
	const links: string[] = [];
	for (const match of markdown.matchAll(WIKILINK_PATTERN)) {
		const slug = wikiTarget(match[1] ?? '').slug;
		if (slug !== '' && !links.includes(slug)) {
			links.push(slug);
		}
	}
	return links;
}

/**
 * @brief Splits a note title or slug from its optional section reference.
 * @param raw Original wikilink target.
 * @return Normalized post slug and safe section fragment.
 */
function wikiTarget(raw: string): { slug: string; fragment: string } {
	const separator = raw.indexOf('#');
	const target = (separator < 0 ? raw : raw.slice(0, separator)).trim();
	const heading = separator < 0 ? '' : raw.slice(separator + 1).trim();
	const slug = target.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
		.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	return { slug, fragment: heading ? sectionId(heading) : '' };
}

/**
 * @brief Escapes a string for safe HTML embedding.
 * @param value The raw string.
 * @return The escaped string.
 */
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * @brief Rewrites wikilinks to placeholder tokens resolved after sanitizing.
 * @param markdown The Markdown source.
 * @return The rewritten source plus the link targets in token order.
 */
function tokenizeWikiLinks(markdown: string): { source: string; links: string[] } {
	const links: string[] = [];
	const source = markdown.replace(WIKILINK_PATTERN, (_whole, rawTarget: string, rawLabel?: string) => {
		const target = String(rawTarget).trim();
		const label = (rawLabel ?? target).trim() || target;
		const index = links.length;
		links.push(target);
		return `[${label}](wikilink:${index})`;
	});
	return { source, links };
}

/**
 * @brief Resolves placeholder tokens into final anchor elements.
 * @param html The sanitized HTML containing tokens.
 * @param labels The link labels in token order.
 * @param slugs The link slugs in token order.
 * @param knownSlugs Optional set marking unknown targets as broken.
 * @return HTML with real anchors.
 */
function resolveWikiLinks(
	html: string,
	labels: string[],
	slugs: string[],
	knownSlugs?: Set<string>
): string {
	let output = html;
	for (let index = 0; index < slugs.length; index += 1) {
		const target = slugs[index] ?? '';
		const { slug, fragment } = wikiTarget(target);
		const label = labels[index] ?? target;
		const broken = slug !== '' && knownSlugs !== undefined && !knownSlugs.has(slug);
		const href = `${slug ? `/posts/${encodeURIComponent(slug)}` : ''}${fragment ? `#${encodeURIComponent(fragment)}` : ''}`;
		const anchor = `<a href="${href}" class="wikilink${broken ? ' broken' : ''}">${escapeHtml(label)}</a>`;
		output = output.replace(`<a href="wikilink:${index}">${escapeHtml(label)}</a>`, anchor);
	}
	return output;
}

/**
 * @brief Strips HTML tags for excerpt and word-count purposes.
 * @param html The sanitized HTML.
 * @return Plain text.
 */
function stripTags(html: string): string {
	return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * @brief Renders Markdown to sanitized HTML with metadata.
 * @param markdown The Markdown body (without frontmatter).
 * @param options Media prefix and optional known slugs for broken-link marks.
 * @return The rendered content.
 */
export async function renderMarkdown(
	markdown: string,
	options: RenderOptions = {}
): Promise<RenderedContent> {
	const tokenized = tokenizeWikiLinks(markdown);
	const parsed = await parseMathMarkdown(tokenized.source);
	const clean = sanitizeHtml(parsed.html, {
		allowedSchemes: ['http', 'https', 'mailto', 'wikilink'],
		allowedTags: [
			'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
			'em', 'strong', 'a', 'hr', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img'
		],
		allowedAttributes: {
			a: ['href', 'title'],
			img: ['src', 'alt', 'title'],
			code: ['class'],
			th: ['align'],
			td: ['align']
		},
		allowedClasses: { code: ['language-*'] }
	});
	const linked = resolveWikiLinks(clean, tokenizedLinksLabels(tokenized.source), tokenized.links, options.knownSlugs);
	const prefixed =
		options.mediaPrefix !== undefined
			? linked.replace(RELATIVE_IMG_PATTERN, `<img$1src="${options.mediaPrefix}/$2"$3>`)
			: linked;
	const html = anchorHeadings(parsed.restore(prefixed));
	const text = stripTags(html.replace(/<annotation\b[^>]*>[\s\S]*?<\/annotation>/g, ''));
	const words = text === '' ? 0 : text.split(' ').length;
	return {
		html,
		excerpt: text.slice(0, 200),
		readingMinutes: Math.max(1, Math.ceil(words / 200)),
		links: extractWikiLinks(markdown)
	};
}

/**
 * @brief Recovers link labels from tokenized Markdown in token order.
 * @param source The tokenized Markdown source.
 * @return The labels in token order.
 */
function tokenizedLinksLabels(source: string): string[] {
	const labels: string[] = [];
	const pattern = /\[([^\]]+?)\]\(wikilink:\d+\)/g;
	for (const match of source.matchAll(pattern)) {
		labels.push(match[1] ?? '');
	}
	return labels;
}
