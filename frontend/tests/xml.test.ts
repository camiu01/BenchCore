/**
 * @file xml.test.ts
 * @brief XML 1.0-safe escaping, including malformed Unicode and forbidden control bytes.
 */
import { describe, expect, it } from 'vitest';
import { escapeXml } from '../src/lib/server/xml.js';

describe('XML syndication text', () => {
	it('escapes markup and quotes without corrupting international text', () => {
		expect(escapeXml(`Circuits < signals & "quotes" 'test' 🧪 città`)).toBe(
			'Circuits &lt; signals &amp; &quot;quotes&quot; &apos;test&apos; 🧪 città'
		);
	});
	it('removes XML-forbidden controls and lone surrogates, keeping whitespace', () => {
		expect(escapeXml('a\u0000\u0008\u000b\u000c\u001f\ufffe\uffff\uD800b\uDC00\t\n\r')).toBe(
			'ab\t\n\r'
		);
	});
});
