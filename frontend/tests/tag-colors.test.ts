/**
 * @file tag-colors.test.ts
 * @brief Strict-CSP tag color rendering and public authentication navigation.
 */
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import TagChip from '../src/lib/components/TagChip.svelte';
import TagColorEditor from '../src/lib/components/TagColorEditor.svelte';
import { authenticationLink } from '../src/lib/navigation.js';

describe('CSP-safe tag colors', () => {
	it('renders a colored badge without inline style attributes', () => {
		const { body } = render(TagChip, { props: { label: 'Systems', color: '#2563EB' } });
		expect(body).toContain('Systems');
		expect(body).toContain('fill="#2563EB"');
		expect(body).not.toMatch(/\sstyle=/);
	});

	it('rejects non-HEX SVG paint references', () => {
		const { body } = render(TagChip, {
			props: { label: 'Invalid', color: 'url(https://example.test)' }
		});
		expect(body).toContain('fill="#64748B"');
		expect(body).not.toContain('https://example.test');
	});

	it('renders every preset as an SVG swatch, without inline styles', () => {
		const { body } = render(TagColorEditor, {
			props: { id: 'tag', name: 'Systems', color: '#2563EB' }
		});
		expect(body.match(/<rect /g)).toHaveLength(8);
		expect(body).not.toMatch(/\sstyle=/);
		expect(body).toContain('Use #2563EB for Systems');
	});
});

describe('public authentication navigation', () => {
	it('shows Login for visitors, Account for readers and Admin for administrators', () => {
		expect(authenticationLink(null, '05')).toEqual({ href: '/login', label: '[05] login' });
		expect(authenticationLink('reader', '04')).toEqual({ href: '/account', label: '[04] account' });
		expect(authenticationLink('admin', '05')).toEqual({ href: '/admin', label: '[05] admin' });
	});
});
