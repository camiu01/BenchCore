/**
 * @file migrate.ts
 * @brief Applies pending Drizzle migrations to PostgreSQL.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env['DATABASE_URL'];
if (url === undefined || url === '') {
	process.stderr.write('DATABASE_URL is not set\n');
	process.exit(1);
}

try {
	const client = postgres(url, { max: 1 });
	await migrate(drizzle(client), { migrationsFolder: './drizzle' });
	await client.end();
	process.stdout.write('migrations applied\n');
	process.exit(0);
} catch (error) {
	const message = error instanceof Error ? error.message : 'migration failed';
	process.stderr.write(`${message}\n`);
	process.exit(1);
}
