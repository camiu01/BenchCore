/**
 * @file scheduler.test.ts
 * @brief Scheduled publisher retries and prevents overlapping ticks.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startPublishingJob } from '../src/posts/scheduler.js';
import { createTestRepos } from './helpers.js';

afterEach(() => { vi.useRealTimers(); });

describe('scheduled publishing job', () => {
	it('runs immediately, skips in-flight ticks and stops cleanly', async () => {
		vi.useFakeTimers();
		const repos = createTestRepos();
		let finish: () => void = () => {};
		const publish = vi.spyOn(repos.posts, 'publishDue').mockImplementation(() => new Promise<number>((resolve) => {
			finish = () => resolve(1);
		}));
		const stop = startPublishingJob(repos.posts, vi.fn(), 100);
		await vi.advanceTimersByTimeAsync(300);
		expect(publish).toHaveBeenCalledTimes(1);
		finish();
		await vi.advanceTimersByTimeAsync(100);
		expect(publish).toHaveBeenCalledTimes(2);
		stop();
		finish();
		await vi.advanceTimersByTimeAsync(300);
		expect(publish).toHaveBeenCalledTimes(2);
	});

	it('reports a failure and retries at the next tick', async () => {
		vi.useFakeTimers();
		const repos = createTestRepos();
		const publish = vi.spyOn(repos.posts, 'publishDue').mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(0);
		const report = vi.fn();
		const stop = startPublishingJob(repos.posts, report, 100);
		await vi.advanceTimersByTimeAsync(100);
		expect(report).toHaveBeenCalledTimes(1);
		expect(publish).toHaveBeenCalledTimes(2);
		stop();
	});
});
