/**
 * @file migrate.ts
 * @brief Applies pending Drizzle migrations to PostgreSQL.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';

const url = process.env['DATABASE_URL'];
if (url === undefined || url === '') {
	process.stderr.write('DATABASE_URL is not set\n');
	process.exit(1);
}

try {
	const client = postgres(url, { max: 1 });
	try {
		await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
	} finally {
		await client.end();
	}
	process.stdout.write('migrations applied\n');
	process.exit(0);
} catch {
	process.stderr.write('migration failed; verify database connectivity and migration state\n');
	process.exit(1);
}
