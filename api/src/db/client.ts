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
let client: ReturnType<typeof postgres> | null = null;

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
		const serverless = process.env['VERCEL'] === '1' || process.env['DEPLOYMENT_TARGET'] === 'vercel';
		client = postgres(url, { connect_timeout: 5, connection: { statement_timeout: 10_000 },
			...(serverless ? { max: 3, idle_timeout: 10, max_lifetime: 300, prepare: false } : {}) });
		cached = drizzle(client, { schema });
	}
	return cached;
}

/**
 * @brief Closes the shared pool during a graceful shutdown.
 * @return Completion.
 */
export async function closeDb(): Promise<void> {
	const current = client;
	client = null;
	cached = null;
	await current?.end({ timeout: 5 });
}

/**
 * @brief Checks connectivity and required migrated columns without reading application rows.
 * @return Completion, or a rejected connection check.
 */
export async function checkDb(): Promise<void> {
	const db = getDb();
	await client!`select 1`;
	await db.select().from(schema.users).limit(0);
	await db.select().from(schema.sessions).limit(0);
	await db.select().from(schema.posts).limit(0);
	await db.select().from(schema.tags).limit(0);
	await db.select().from(schema.postTags).limit(0);
	await db.select().from(schema.mediaBlobs).limit(0);
}
