/**
 * @file cleanup-service.ts
 * @brief Explicit, dry-run-first orphan cleanup with saved-use rechecks.
 */
import { z } from 'zod';
import type { PostRepository } from '../db/repositories.js';
import type { StorageProvider } from './storage.js';
import { mediaRecord } from './storage.js';
import { deleteManagedImage, imageUsage } from './deletion-service.js';

const optionsSchema = z.object({
	apply: z.boolean().default(false),
	maintenance: z.boolean().default(false),
	limit: z.number().int().min(1).max(1000).default(100)
}).strict().refine((options) => !options.apply || options.maintenance, {
	message: 'Stop application writers and acknowledge maintenance mode before applying cleanup.'
});

/** @brief Conservatively reserves every mentioned safe key, including absolute URLs and ambiguous prose/code references. @param rows Saved posts. @return Reserved keys. */
function reservedKeys(rows: { contentMarkdown: string; coverImage: string | null }[]): Set<string> {
	const keys = new Set<string>();
	for (const row of rows) {
		for (const value of [row.contentMarkdown, row.coverImage ?? '']) {
			for (const match of value.matchAll(/[A-Za-z0-9]{32}\.(?:png|jpg|jpeg|webp|gif)/g)) keys.add(match[0]);
		}
	}
	return keys;
}

/** @brief Parses explicit cleanup arguments, without accepting unknown flags. @param args CLI arguments. @return Safe options. */
export function cleanupArguments(args: string[]) {
	let apply = false, maintenance = false, limit = 100;
	for (let index = 0; index < args.length; index++) {
		const flag = args[index];
		if (flag === '--apply') apply = true;
		else if (flag === '--maintenance') maintenance = true;
		else if (flag === '--dry-run') { if (apply) throw new Error('Conflicting cleanup modes'); }
		else if (flag === '--limit') limit = z.coerce.number().int().parse(args[++index]);
		else throw new Error('Unsupported cleanup argument');
	}
	if (apply && args.includes('--dry-run')) throw new Error('Conflicting cleanup modes');
	return optionsSchema.parse({ apply, maintenance, limit });
}

/** @brief Scans all saved statuses and deletes only rechecked orphan candidates when explicitly requested. @param posts Post repository. @param storage Storage seam. @param input Validated cleanup controls. @return Counts without filenames or content. */
export async function cleanupOrphanMedia(posts: PostRepository, storage: StorageProvider, input: unknown = {}) {
	const options = optionsSchema.parse(input);
	const used = reservedKeys(await posts.listAll());
	const records = z.array(mediaRecord).parse(await storage.list());
	const candidates = [...new Map(records.map((record) => [record.key, record])).values()]
		.filter((record) => !used.has(record.key)).sort((a, b) => a.key.localeCompare(b.key));
	const selected = candidates.slice(0, options.limit);
	const result = { mode: options.apply ? 'apply' : 'dry-run', scanned: records.length,
		orphaned: candidates.length, selected: selected.length, deleted: 0, skipped: 0, failed: 0 };
	if (!options.apply) return result;
	for (const candidate of selected) {
		try {
			if (reservedKeys(await posts.listAll()).has(candidate.key)) { result.skipped++; continue; }
			const usage = await imageUsage(posts, candidate.key);
			if (usage.rows.length) { result.skipped++; continue; }
			const outcome = await deleteManagedImage(posts, storage, candidate.key, usage.version);
			if (outcome === 'deleted') result.deleted++;
			else if (outcome === 'conflict') result.skipped++;
			else result.failed++;
		} catch { result.failed++; }
	}
	return result;
}
