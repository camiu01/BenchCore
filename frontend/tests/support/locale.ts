/**
 * @file locale.ts
 * @brief Test helper that selects the language rendered by components during one test.
 */
import type { Locale } from '../../src/lib/i18n/locale.js';

/**
 * @brief Switches the mocked page language.
 * @param locale Language to render.
 * @return Nothing.
 */
export function setTestLocale(locale: Locale): void {
	const state = Reflect.get(globalThis, '__testPageState') as { data: Record<string, unknown> };
	state.data['locale'] = locale;
}
