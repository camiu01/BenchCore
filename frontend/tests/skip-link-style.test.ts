/**
 * @file skip-link-style.test.ts
 * @brief Skip links stay hidden until focused and never overlap the preceding cookie notice.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('../src/lib/usability.css', import.meta.url), 'utf8');

describe('skip link layout', () => {
	it('clips the unfocused link instead of translating it into preceding content', () => {
		const hidden = styles.match(/\.skip-link \{([^}]+)}/)?.[1];
		expect(hidden).toContain('clip-path: inset(50%);');
		expect(hidden).toContain('overflow: hidden;');
		expect(hidden).not.toContain('transform:');
	});

	it('reserves space inside the sheet when focused and wraps on narrow screens', () => {
		const focused = styles.match(/\.skip-link:focus \{([^}]+)}/)?.[1];
		expect(focused).toContain('position: static;');
		expect(focused).toContain('clip-path: none;');
		expect(focused).toContain('max-width: 100%;');
		expect(focused).toContain('white-space: normal;');
	});
});
