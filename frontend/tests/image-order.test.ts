/**
 * @file image-order.test.ts
 * @brief Stand-alone image ordering preserves code, reference definitions and prose.
 */
import { describe, expect, it } from 'vitest';
import { reorderPostImage, reorderableImageKeys } from '../src/lib/image-order.js';

const first = `${'a'.repeat(32)}.png`;
const second = `${'b'.repeat(32)}.png`;
const a = `![First [caption]](/api/media/${first})`;
const b = `![Second](/api/media/${second})`;

describe('saved image ordering', () => {
	it('swaps actual image paragraphs without moving intervening prose or code examples', () => {
		const before = `Intro\n\n\`\`\`md\n${a}\n\`\`\`\n\n${a}\n\nKeep this prose.\n\n${b}\n\nEnd`;
		expect(reorderableImageKeys(before)).toEqual([first, second]);
		expect(reorderPostImage(before, second, -1)).toBe(
			`Intro\n\n\`\`\`md\n${a}\n\`\`\`\n\n${b}\n\nKeep this prose.\n\n${a}\n\nEnd`
		);
	});

	it('preserves reference definitions and avoids nested, repeated and inline images', () => {
		const reference = `![Reference][photo]\n\n${b}\n\n[photo]: /api/media/${first}\n`;
		expect(reorderPostImage(reference, first, 1)).toBe(
			`${b}\n\n![Reference][photo]\n\n[photo]: /api/media/${first}\n`
		);
		for (const source of [
			`Text ${a}\n\n${b}`,
			`> ${a}\n\n${b}`,
			`${a}\n\n${a}\n\n${b}`,
			`\`${a}\`\n\n${b}`
		]) {
			expect(reorderPostImage(source, first, 1)).toBe(source);
		}
	});
});
