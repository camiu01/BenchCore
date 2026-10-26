/**
 * @file theme-contrast.test.ts
 * @brief Measured WCAG text and control-boundary contrast for all theme tokens.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/lib/styles/tokens.css', import.meta.url), 'utf8');

/**
 * @brief Calculates WCAG sRGB relative luminance.
 * @param hex Six-digit sRGB color.
 * @return Relative luminance.
 */
function luminance(hex: string): number {
	const channels = hex.slice(1).match(/../g);
	if (!channels) throw new Error('Invalid fixture color');
	const linear = channels.map((channel) => {
		const value = parseInt(channel, 16) / 255;
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});
	return (linear[0] ?? 0) * 0.2126 + (linear[1] ?? 0) * 0.7152 + (linear[2] ?? 0) * 0.0722;
}

/**
 * @brief Measures the contrast of two opaque theme colors.
 * @param first Foreground. @param second Background.
 * @return Contrast ratio.
 */
function contrast(first: string, second: string): number {
	const a = luminance(first),
		b = luminance(second);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe.each(['light', 'dark', 'oled'])('%s theme contrast', (theme) => {
	const block = css.match(new RegExp(`html\\[data-theme='${theme}'\\] \\{([^}]+)\\}`))?.[1] ?? '';
	/**
	 * @brief Reads an opaque token from the actual theme declaration.
	 * @param name CSS variable name. @return Hex color.
	 */
	const token = (name: string): string => {
		const value = block.match(new RegExp(`--${name}: (#[a-f0-9]{6});`))?.[1];
		if (!value) throw new Error(`Missing ${theme} token: ${name}`);
		return value;
	};
	for (const surface of ['bg', 'sheet-bg', 'card-bg']) {
		it(`keeps normal, muted and accent text readable on ${surface}`, () => {
			for (const ink of ['ink', 'muted', 'accent']) {
				expect(contrast(token(ink), token(surface)), `${ink} on ${surface}`).toBeGreaterThanOrEqual(
					4.5
				);
			}
		});
		it(`keeps control boundaries visible on ${surface}`, () => {
			expect(contrast(token('control-border'), token(surface))).toBeGreaterThanOrEqual(3);
		});
	}
	it('keeps active controls readable on the accent background', () => {
		expect(contrast(token('accent-ink'), token('accent'))).toBeGreaterThanOrEqual(4.5);
	});
});
