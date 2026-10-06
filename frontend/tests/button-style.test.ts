/**
 * @file button-style.test.ts
 * @brief Original engineering-log button appearance with accessible touch targets.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const forms = readFileSync(new URL('../src/lib/forms.css', import.meta.url), 'utf8');
const usability = readFileSync(new URL('../src/lib/usability.css', import.meta.url), 'utf8');

describe('engineering-log buttons', () => {
	it('inherits the original uppercase monospace typography and keeps square corners', () => {
		const base = forms.match(/\.btn \{([^}]+)}/)?.[1];
		const overrides = [...usability.matchAll(/^\.wrapper \.btn \{([^}]+)}/gm)].at(-1)?.[1];
		expect(base).toContain('font-family: inherit;');
		expect(base).toContain('font-size: 11px;');
		expect(base).toContain('letter-spacing: 0.5px;');
		expect(base).toContain('text-transform: uppercase;');
		expect(overrides).toContain('border-radius: 0;');
		expect(overrides).toContain('padding: 6px 14px;');
		expect(overrides).not.toMatch(/font-size:|font-family:|text-transform:|letter-spacing:/);
	});

	it('preserves comfortable touch targets without changing the original appearance', () => {
		const shared = usability.match(/\.wrapper \.doc-nav a,\s*\.wrapper \.btn \{([^}]+)}/)?.[1];
		expect(shared).toContain('min-height: 44px;');
	});

	it('gives graph topic buttons the same square, uppercase style', () => {
		const topics = usability.match(/\.topic-filter \{([^}]+)}/)?.[1];
		expect(topics).toContain('border-radius: 0;');
		expect(topics).toContain('text-transform: uppercase;');
		expect(topics).toContain('min-height: 44px;');
	});
});
