/**
 * @file client.ts
 * @brief Lazy PostgreSQL client. Throws a clear error when DATABASE_URL is missing.
 */
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

/**
 * @brief The application database handle type.
 */
export type AppDb = PostgresJsDatabase<typeof schema>;

let cached: AppDb | null = null;

/**
 * @brief Returns the shared Drizzle database handle.
 * @return The database handle.
 */
export function getDb(): AppDb {
	const url = process.env['DATABASE_URL'];
	if (url === undefined || url === '') {
		throw new Error('DATABASE_URL is not set');
	}
	if (cached === null) {
		cached = drizzle(postgres(url), { schema });
	}
	return cached;
}
