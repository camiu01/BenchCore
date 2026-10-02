/**
 * @file branding.test.ts
 * @brief BenchCore RSS identity and XML-safe expanded project title.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../src/routes/rss.xml/+server.js';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('BenchCore feed branding', () => {
	it('uses BenchCore and escapes the ampersand in the expanded title', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ items: [], total: 0 })));
		const response = await GET({} as Parameters<typeof GET>[0]);
		const xml = await response.text();
		expect(response.status).toBe(200);
		expect(xml).toContain('<title>BenchCore</title>');
		expect(xml).toContain(
			'Embedded Networks, &amp; Circuit Hacks: Centralized Open-source Research Engine'
		);
		expect(xml).not.toContain('Engineering Log');
	});
});
