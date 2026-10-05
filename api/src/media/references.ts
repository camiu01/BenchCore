/**
 * @file references.ts
 * @brief Browser-safe managed image reference parsing shared by editor and API.
 */
import { marked } from 'marked';

const KEY = /^[A-Za-z0-9]{32}\.(png|jpg|jpeg|webp|gif)$/;
const HTML_IMAGES = /<!--[\s\S]*?-->|<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;

/**
 * @brief Reads an actual HTML image source without matching text inside another attribute.
 * @param tag Image tag or ignored HTML comment.
 * @return Managed source key, including valid unquoted attributes, or null.
 */
function htmlImageKey(tag: string): string | null {
	if (!/^<img\b/i.test(tag)) return null;
	const attributes = tag.slice(4, -1);
	for (const match of attributes.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
		if (match[1]!.toLowerCase() === 'src') {
			return managedImageKey(match[2] ?? match[3] ?? match[4] ?? '');
		}
	}
	return null;
}

/**
 * @brief Recognizes only local application-owned media references.
 * @param value Image or cover reference.
 * @return Opaque media key or null for external images.
 */
export function managedImageKey(value: string): string | null {
	if (KEY.test(value)) return value;
	const match = /^\/api\/media\/([^/?#]+)(?:[?#].*)?$/.exec(value);
	return match && KEY.test(match[1]!) ? match[1]! : null;
}

/**
 * @brief Lists image keys from Markdown images, HTML images and the cover.
 * @param content Markdown source.
 * @param cover Cover reference.
 * @return Unique managed image keys.
 */
export function managedImageKeys(content: string, cover: string): string[] {
	const keys = new Set<string>();
	const coverKey = managedImageKey(cover);
	if (coverKey) keys.add(coverKey);
	marked.walkTokens(marked.lexer(content), (token) => {
		if (token.type === 'image') {
			const key = managedImageKey(token.href);
			if (key) keys.add(key);
		}
		if (token.type === 'html') {
			for (const match of token.raw.matchAll(HTML_IMAGES)) {
				const key = htmlImageKey(match[0]);
				if (key) keys.add(key);
			}
		}
	});
	return [...keys];
}

/**
 * @brief Removes actual image references while preserving unrelated text.
 * @param content Markdown source.
 * @param key Managed image key.
 * @return Markdown without images referencing the key.
 */
export function removeImageReferences(content: string, key: string): string {
	let prefix = 'MEDIA_PROTECTED_CODE_';
	while (content.includes(prefix)) prefix += '_';
	const code = new Map<string, string>();
	let output = content;
	marked.walkTokens(marked.lexer(content), (token) => {
		if (token.type !== 'code' && token.type !== 'codespan') return;
		const placeholder = `${prefix}${code.size}_END`;
		code.set(placeholder, token.raw);
		output = output.split(token.raw).join(placeholder);
	});
	marked.walkTokens(marked.lexer(output), (token) => {
		if (token.type === 'image' && managedImageKey(token.href) === key) {
			output = output.replace(token.raw, '');
		}
		if (token.type === 'html') {
			const cleaned = token.raw.replace(
				HTML_IMAGES,
				(whole) => htmlImageKey(whole) === key ? '' : whole
			);
			output = output.replace(token.raw, cleaned);
		}
	});
	for (const [placeholder, raw] of code) output = output.split(placeholder).join(raw);
	return output;
}
