/**
 * @file theme.ts
 * @brief * Theme preference helpers for the engineering-log design system.
 * Presentation-only state (localStorage + data-theme attribute).
 * No business logic lives here.
 */

/** Available site themes. */
export const THEMES = ['light', 'dark', 'oled'] as const;

/** A site theme identifier. */
export type Theme = (typeof THEMES)[number];

/** localStorage key for the persisted theme preference. */
const STORAGE_KEY = 'site-theme';

/**
 * @brief Checks whether a value is a known theme identifier.
 * @param value - The value to check.
 * @returns True when the value is a valid theme.
 */
export function isTheme(value: string): value is Theme {
	return (THEMES as readonly string[]).includes(value);
}

/**
 * @brief Reads the persisted theme, defaulting to light when unavailable or invalid.
 * Safe to call during SSR (no document/localStorage access that can throw).
 * @returns The stored theme or 'light'.
 */
export function getStoredTheme(): Theme {
	try {
		if (typeof localStorage === 'undefined') {
			return 'light';
		}
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored !== null && isTheme(stored) ? stored : 'light';
	} catch {
		return 'light';
	}
}

/**
 * @brief Applies a theme to the document and persists the preference.
 * No-op during SSR.
 * @param theme - The theme to apply.
 * @return The result, or a redirect for completed mutations.
 */
export function applyTheme(theme: Theme): void {
	if (typeof document === 'undefined') {
		return;
	}
	document.documentElement.setAttribute('data-theme', theme);
	try {
		localStorage.setItem(STORAGE_KEY, theme);
	} catch {
		// Storage unavailable (private mode, SSR); the attribute is already set.
	}
}
