/**
 * Theme helper tests.
 * Covers pure presentation logic; document access is SSR-guarded.
 */
import { describe, expect, it } from 'vitest';
import { getStoredTheme, isTheme } from '../src/lib/theme.js';

describe('theme helpers', () => {
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
