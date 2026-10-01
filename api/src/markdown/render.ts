/**
 * @file render.ts
 * @brief Markdown rendering: Obsidian-style [[wikilinks]], sanitized HTML, metadata.
 */
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

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
		const slug = (match[1] ?? '').trim().toLowerCase();
		if (slug !== '' && !links.includes(slug)) {
			links.push(slug);
		}
	}
	return links;
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
		const slug = String(rawTarget).trim().toLowerCase();
		const label = (rawLabel ?? slug).trim() || slug;
		const index = links.length;
		links.push(slug);
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
		const slug = slugs[index] ?? '';
		const label = labels[index] ?? slug;
		const broken = knownSlugs !== undefined && !knownSlugs.has(slug);
		const anchor = `<a href="/posts/${encodeURIComponent(slug)}" class="wikilink${broken ? ' broken' : ''}">${escapeHtml(label)}</a>`;
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
	const rawHtml = await marked.parse(tokenized.source);
	const clean = sanitizeHtml(typeof rawHtml === 'string' ? rawHtml : String(rawHtml), {
		allowedSchemes: ['http', 'https', 'mailto', 'wikilink'],
		allowedTags: [
			'h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
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
	const text = stripTags(prefixed);
	const words = text === '' ? 0 : text.split(' ').length;
	return {
		html: prefixed,
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
