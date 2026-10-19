/**
 * @file theme.test.ts
 * @brief * Theme helper tests.
 * Covers pure presentation logic; document access is SSR-guarded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getStoredTheme, isTheme } from '../src/lib/theme.js';

afterEach(() => vi.unstubAllGlobals());

describe('theme helpers', () => {
	it.each([
		['light', '#f5f2ea'],
		['dark', '#15181c'],
		['oled', '#000000']
	] as const)('updates browser chrome for the %s theme', (theme, color) => {
		const setAttribute = vi.fn();
		const rootAttribute = vi.fn();
		vi.stubGlobal('document', {
			documentElement: { setAttribute: rootAttribute },
			querySelector: vi.fn().mockReturnValue({ setAttribute })
		});
		applyTheme(theme);
		expect(rootAttribute).toHaveBeenCalledWith('data-theme', theme);
		expect(setAttribute).toHaveBeenCalledWith('content', color);
	});

	it('recognizes known themes only', () => {
		expect(isTheme('light')).toBe(true);
		expect(isTheme('dark')).toBe(true);
		expect(isTheme('oled')).toBe(true);
		expect(isTheme('neon')).toBe(false);
	});

	it('defaults to light without storage (SSR/node)', () => {
		expect(getStoredTheme()).toBe('light');
	});
});
