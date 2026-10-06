/**
 * @file media.ts
 * @brief Operator-only orphan cleanup, dry-run by default, without startup migrations.
 */
import { closeDb, getDb } from '../db/client.js';
import { createDrizzleRepos } from '../db/drizzle.js';
import { configuredStorage } from '../media/configured.js';
import { cleanupArguments, cleanupOrphanMedia } from '../media/cleanup-service.js';

/** @brief Performs only the explicitly selected maintenance operation. @return Completion. */
async function main(): Promise<void> {
	if (process.argv.includes('--help')) {
		process.stdout.write('media cleanup [--dry-run] [--limit 100] [--apply --maintenance]\nStop application writers and back up before --apply. Never run during active uploads.\n');
		return;
	}
	if (process.argv[2] !== 'cleanup') throw new Error('Select cleanup');
	const options = cleanupArguments(process.argv.slice(3));
	const db = getDb();
	const result = await cleanupOrphanMedia(createDrizzleRepos(db).posts, configuredStorage(db, process.env), options);
	process.stdout.write(`${JSON.stringify(result)}\n`);
	if (result.failed) process.exitCode = 1;
}

main().catch(() => {
	process.stderr.write('Media cleanup failed. Verify arguments, maintenance acknowledgement and storage/database access. No credentials or filenames were printed.\n');
	process.exitCode = 1;
}).finally(closeDb);
