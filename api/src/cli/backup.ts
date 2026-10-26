/**
 * @file backup.ts
 * @brief Offline private backup, verification and empty-target-only recovery commands.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { backendSchema } from '../backup/manifest.js';
import { backupArguments, disjointPaths, restoreEnvironment } from '../backup/arguments.js';
import { plainDirectory } from '../backup/files.js';
import { createBackupDatabase } from '../backup/postgres.js';
import { exportBackup, restoreBackup, verifyBackup } from '../backup/service.js';
import { closeDb, getDb } from '../db/client.js';
import { configuredStorage } from '../media/configured.js';

const usage =
	'backup export|verify|restore --directory <private-path> [--maintenance] [--trust-backup]\n';

/** @brief Validates explicit operator intent and never logs connection URLs or content. @return Completion. */
async function main(): Promise<void> {
	const command = backupArguments(process.argv.slice(2));
	if (command.help) {
		process.stdout.write(usage);
		return;
	}
	const { action, directory } = command;
	const backend = backendSchema.parse(
		process.env['MEDIA_STORAGE'] ?? (process.env['VERCEL'] === '1' ? 'r2' : 'local')
	);
	const { version: appVersion } = z
		.object({ version: z.string() })
		.parse(JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')));
	if (action === 'verify') {
		await verifyBackup({ directory, backend, appVersion });
		process.stdout.write('Backup integrity verified; this is not a recovery drill\n');
		return;
	}
	const env = action === 'restore' ? restoreEnvironment(process.env, backend) : process.env;
	const url = z.string().min(1).parse(env['DATABASE_URL']);
	if (backend === 'local') {
		const mediaDirectory = resolve(env['MEDIA_DIR'] ?? './data/media');
		await disjointPaths(directory, mediaDirectory);
		if (action === 'export') await plainDirectory(mediaDirectory);
	}
	if (action === 'restore') process.env['DATABASE_URL'] = url;
	const options = {
		directory,
		backend,
		appVersion,
		maintenance: true,
		database: createBackupDatabase(url),
		media: configuredStorage(getDb(), env)
	};
	const manifest =
		action === 'export' ? await exportBackup(options) : await restoreBackup(options, true);
	process.stdout.write(
		`Backup ${action} completed; ${manifest.media.length} managed images verified\n`
	);
}

process.umask(0o077);
try {
	await main();
} catch {
	process.stderr.write(
		'Backup command failed; no overwrite is allowed. Check arguments, private paths, client tools and isolated target state.\n' +
			usage
	);
	process.exitCode = 1;
} finally {
	await closeDb();
}
