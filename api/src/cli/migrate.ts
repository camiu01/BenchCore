/**
 * @file migrate.ts
 * @brief Applies release migrations explicitly, without importing development tooling.
 */
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { closeDb, getDb } from '../db/client.js';

try {
	await migrate(getDb(), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
	process.stdout.write('migrations applied\n');
} catch {
	process.stderr.write('Migration failed; verify connectivity and migration state before starting\n');
	process.exitCode = 1;
} finally {
	await closeDb();
}
