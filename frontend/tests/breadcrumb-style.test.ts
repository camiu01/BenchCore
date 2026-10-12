/**
 * @file breadcrumb-style.test.ts
 * @brief Breadcrumb separator alignment without reducing touch targets or narrow-screen wrapping.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const browse = readFileSync(new URL('../src/lib/browse.css', import.meta.url), 'utf8');

describe('reader breadcrumbs', () => {
	it('centers separators and the current record against full-height links', () => {
		const layout = browse.match(/\.breadcrumb \{([^}]+)}/)?.[1];
		expect(layout).toContain('display: flex;');
		expect(layout).toContain('align-items: center;');
	});

	it('preserves narrow-screen wrapping and accessible link targets', () => {
		const layout = browse.match(/\.breadcrumb \{([^}]+)}/)?.[1];
		const links = browse.match(/\.breadcrumb a \{([^}]+)}/)?.[1];
		const current = browse.match(/\.breadcrumb \[aria-current=['"]page['"]\] \{([^}]+)}/)?.[1];
		expect(layout).toContain('flex-wrap: wrap;');
		expect(links).toContain('min-height: 44px;');
		expect(current).toContain('overflow-wrap: anywhere;');
	});
});
