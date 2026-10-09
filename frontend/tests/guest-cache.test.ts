/**
 * @file guest-cache.test.ts
 * @brief Guest reads are shared briefly; failures and viewer sessions are never cached.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearGuestCache, guestCacheTtl, guestCached } from '../src/lib/guest-cache.js';

describe('guest cache', () => {
	beforeEach(() => clearGuestCache());

	it('reuses a fresh result and reloads after expiry', async () => {
		const load = vi.fn().mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 2 });
		expect(await guestCached('/a', load, 1000, 0)).toEqual({ n: 1 });
		expect(await guestCached('/a', load, 1000, 500)).toEqual({ n: 1 });
		expect(await guestCached('/a', load, 1000, 1001)).toEqual({ n: 2 });
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('never stores failures', async () => {
		const load = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ ok: true });
		expect(await guestCached('/b', load, 1000, 0)).toBeNull();
		expect(await guestCached('/b', load, 1000, 1)).toEqual({ ok: true });
	});

	it('shares one in-flight request between concurrent visitors', async () => {
		const load = vi.fn(() => Promise.resolve({ shared: true }));
		await Promise.all([guestCached('/c', load, 1000, 0), guestCached('/c', load, 1000, 0)]);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it('is disabled under test unless configured', () => {
		expect(guestCacheTtl()).toBe(0);
	});
});
