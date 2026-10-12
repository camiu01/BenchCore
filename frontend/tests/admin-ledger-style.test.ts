/**
 * @file admin-ledger-style.test.ts
 * @brief Stable selection/content/action tracks and narrow-screen ledger wrapping.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/lib/admin-workspace.css', import.meta.url), 'utf8');

describe('admin ledger layout', () => {
	it('bounds the translated bulk-delete button to the available form width', () => {
		const button = css.match(/\.admin-bulk-form \.btn \{([^}]+)}/)?.[1];
		expect(button).toContain('max-width: 100%;');
		expect(button).toContain('overflow-wrap: anywhere;');
	});

	it('reserves the checkbox track and lets the title use remaining width', () => {
		const card = css.match(/\.admin-post-card \{([^}]+)}/)?.[1];
		expect(card).toContain('display: grid;');
		expect(card).toContain('grid-template-columns: 44px minmax(0, 1fr) auto;');
		const content = css.match(/\.admin-post-content \{([^}]+)}/)?.[1];
		expect(content).toContain('min-width: 0;');
		expect(content).toContain('overflow-wrap: anywhere;');
	});

	it('preserves selection hit targets and wraps actions on narrow screens', () => {
		const selection = css.match(/\.admin-post-selection \{([^}]+)}/)?.[1];
		expect(selection).toContain('width: 44px;');
		expect(selection).toContain('min-height: 44px;');
		expect(css).toContain('flex-wrap: wrap;');
		const mobile = css.slice(css.indexOf('@media (max-width: 600px)'));
		expect(mobile).toContain('grid-template-columns: 44px minmax(0, 1fr);');
		expect(mobile).toContain('grid-column: 2;');
	});
});
