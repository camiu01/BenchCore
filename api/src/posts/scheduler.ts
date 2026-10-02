/**
 * @file scheduler.ts
 * @brief Non-overlapping scheduled publication with recoverable process-local ticks.
 */
import type { PostRepository } from '../db/repositories.js';

/**
 * @brief Starts scheduled publishing immediately and once per minute.
 * @param posts Post repository with atomic due-publication updates.
 * @param reportError Failure reporter without database details.
 * @param intervalMs Tick interval.
 * @return Stop callback.
 */
export function startPublishingJob(posts: PostRepository,
	reportError: () => void = () => process.stderr.write('scheduled publishing failed; retrying next tick\n'),
	intervalMs: number = 60_000): () => void {
	let running = false;
	/**
	 * @brief Promotes due drafts without overlapping a previous tick.
	 * @return Nothing.
	 */
	async function tick(): Promise<void> {
		if (running) { return; }
		running = true;
		try { await posts.publishDue(new Date()); }
		catch { reportError(); }
		finally { running = false; }
	}
	void tick();
	const timer = setInterval(() => { void tick(); }, intervalMs);
	timer.unref();
	return () => clearInterval(timer);
}
