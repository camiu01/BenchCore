/**
 * @file page-state.ts
 * @brief Vitest setup that replaces SvelteKit's request-bound page state with a mutable test double.
 */
import { vi } from 'vitest';

const state = vi.hoisted(() => {
	const value = {
		data: { locale: 'en' } as Record<string, unknown>,
		url: new URL('http://localhost/')
	};
	Reflect.set(globalThis, '__testPageState', value);
	return value;
});

vi.mock('$app/state', () => ({ page: state }));
