/**
 * @file admin-pagination.test.ts
 * @brief Server-side ledger query transport and filter-preserving navigation.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminFilters, adminPageHref } from '../src/lib/admin-pagination.js';
import { load } from '../src/routes/admin/+page.server.js';

afterEach(() => vi.unstubAllGlobals());

describe('admin pagination', () => {
	it('normalizes unsafe page and status parameters', () => {
		expect(adminFilters(new URL('https://example.test/admin?page=-1&status=bad'))).toEqual({
			page: 1,
			search: '',
			status: 'all'
		});
		expect(adminFilters(new URL('https://example.test/admin?page=40002')).page).toBe(1);
	});

	it('encodes search text and preserves status while paging', () => {
		expect(adminPageHref('a & b', 'draft', 2)).toBe('/admin?search=a+%26+b&status=draft&page=2');
		expect(adminPageHref('', 'all')).toBe('/admin');
	});

	it('forwards bounded filters and session cookies to the API', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			Response.json({
				items: [],
				total: 60,
				counts: { all: 90, draft: 60, published: 30, archived: 0 }
			})
		);
		vi.stubGlobal('fetch', fetcher);
		const result = await load({
			url: new URL('https://example.test/admin?search=Alpha&status=draft&page=2'),
			request: new Request('https://example.test/admin', { headers: { cookie: 'session=test' } })
		} as Parameters<typeof load>[0]);
		expect(result).toMatchObject({
			total: 60,
			page: 2,
			totalPages: 3,
			status: 'draft',
			search: 'Alpha',
			online: true
		});
		expect(String(fetcher.mock.calls[0]![0])).toContain(
			'limit=25&offset=25&search=Alpha&status=draft'
		);
		expect(fetcher.mock.calls[0]![1].headers.cookie).toBe('session=test');
	});
});
