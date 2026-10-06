/**
 * @file image-order.ts
 * @brief Safe reordering of stand-alone Markdown image paragraphs, never code or prose.
 */
import { marked } from 'marked';
import { managedImageKey } from '../../../api/src/media/references.js';

/** @brief Locates unambiguous image paragraphs outside nested structures. @param content Markdown. @return Exact image paragraph ranges. */
function imageParagraphs(content: string) {
	let cursor = 0;
	const spans: { key: string; start: number; end: number; raw: string }[] = [];
	for (const token of marked.lexer(content)) {
		const start = content.indexOf(token.raw, cursor);
		if (start < 0) continue;
		cursor = start + token.raw.length;
		if (token.type !== 'paragraph' || token.tokens?.length !== 1) continue;
		const image = token.tokens[0];
		if (image?.type !== 'image') continue;
		const key = managedImageKey(image.href);
		if (key) spans.push({ key, start, end: cursor, raw: token.raw });
	}
	const counts = new Map<string, number>();
	for (const span of spans) counts.set(span.key, (counts.get(span.key) ?? 0) + 1);
	return spans.filter((span) => counts.get(span.key) === 1);
}

/** @brief Lists image references which can safely move between standalone slots. @param content Markdown. @return Ordered unique keys. */
export function reorderableImageKeys(content: string): string[] {
	return imageParagraphs(content).map((span) => span.key);
}

/** @brief Swaps complete image paragraphs without rewriting captions, URLs, code or intervening prose. @param content Markdown. @param key Selected image. @param direction Previous or next slot. @return Updated Markdown. */
export function reorderPostImage(content: string, key: string, direction: -1 | 1): string {
	const spans = imageParagraphs(content);
	const index = spans.findIndex((span) => span.key === key);
	const target = index + direction;
	if (index < 0 || target < 0 || target >= spans.length) return content;
	const left = spans[Math.min(index, target)]!;
	const right = spans[Math.max(index, target)]!;
	return (
		content.slice(0, left.start) +
		right.raw +
		content.slice(left.end, right.start) +
		left.raw +
		content.slice(right.end)
	);
}

/** @brief Applies a local reorder and emits dirty-state updates, without saving automatically. @param textarea Live editor. @param key Image. @param direction Previous or next. @return Nothing. */
export function moveEditorImage(
	textarea: HTMLTextAreaElement,
	key: string,
	direction: -1 | 1
): void {
	const content = reorderPostImage(textarea.value, key, direction);
	if (content === textarea.value) return;
	textarea.value = content;
	textarea.dispatchEvent(new Event('input', { bubbles: true }));
}
