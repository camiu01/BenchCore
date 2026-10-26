/**
 * @file backup-postgres.test.ts
 * @brief Opt-in real PostgreSQL recovery drill, refusing non-loopback or populated targets.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { describe, expect, it } from 'vitest';
import { createBackupDatabase } from '../src/backup/postgres.js';
import { exportBackup, restoreBackup } from '../src/backup/service.js';
import { assertEmptyDatabase } from '../src/db/backup.js';
import { createDrizzleMedia } from '../src/db/drizzle-media.js';
import { createDatabaseStorage, createLocalStorage } from '../src/media/storage.js';
import { recoveryImage, seedRecoveryFixture } from './backup-postgres-fixture.js';
import * as schema from '../src/db/schema.js';

const names = [
	'BACKUP_TEST_SOURCE_URL',
	'BACKUP_TEST_LOCAL_URL',
	'BACKUP_TEST_DATABASE_URL'
] as const;
const enabled = names.some((name) => process.env[name] !== undefined);

/** @brief Requires three explicitly configured, distinct loopback-only *_test databases. @return Validated private connection strings. */
function connections(): string[] {
	const values = names.map((name) => process.env[name] ?? '');
	let urls: URL[];
	try {
		urls = values.map((value) => new URL(value));
	} catch {
		throw new Error('Three recovery test URLs are required');
	}
	for (const url of urls) {
		if (
			!['postgres:', 'postgresql:'].includes(url.protocol) ||
			!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
			!/^\/[a-z0-9_]+_test$/.test(url.pathname) ||
			url.search ||
			url.hash
		) {
			throw new Error(
				'Recovery drill requires explicit loopback *_test databases without URL options'
			);
		}
	}
	const databases = new Set(urls.map((url) => `${url.port || '5432'}${url.pathname}`));
	if (databases.size !== urls.length) throw new Error('Recovery drill databases must be distinct');
	return values;
}

/** @brief Captures every public/migration table and complete rows, including bytea and generated vectors. @param sql Isolated test connection. @return Stable private in-memory table snapshot. */
async function snapshot(sql: ReturnType<typeof postgres>): Promise<Record<string, string[]>> {
	const tables = await sql`select schemaname, tablename from pg_tables
		where schemaname in ('public', 'drizzle') order by schemaname, tablename`;
	const result: Record<string, string[]> = {};
	for (const table of tables) {
		const schema = String(table['schemaname']),
			name = String(table['tablename']);
		const rows = await sql`select row_to_json(t)::text as value from ${sql(schema)}.${sql(name)} t`;
		result[`${schema}.${name}`] = rows.map((row) => String(row['value'])).sort();
	}
	return result;
}

/** @brief Runs one native recovery without mutating either existing source configuration or storage. @param source Seeded source. @param target Empty target. @param urls Explicit test connections. @param directory Owned temporary files. @param backend Storage mode. @return Completion. */
async function recoverBackend(
	source: ReturnType<typeof postgres>,
	target: ReturnType<typeof postgres>,
	urls: [string, string],
	directory: string,
	backend: 'local' | 'database'
): Promise<void> {
	const media =
		backend === 'database'
			? createDatabaseStorage(createDrizzleMedia(drizzle(source, { schema })))
			: createLocalStorage(join(directory, 'local-source'));
	if (backend === 'local') await media.restore!(recoveryImage, recoveryImage.data);
	const { version } = JSON.parse(
		await readFile(new URL('../package.json', import.meta.url), 'utf8')
	);
	const options = {
		directory: join(directory, `${backend}-archive`),
		backend,
		appVersion: String(version),
		maintenance: true,
		database: createBackupDatabase(urls[0]),
		media
	};
	await exportBackup(options);
	const restoredMedia =
		backend === 'database'
			? createDatabaseStorage(createDrizzleMedia(drizzle(target, { schema })))
			: createLocalStorage(join(directory, 'local-restored'));
	await restoreBackup(
		{ ...options, database: createBackupDatabase(urls[1]), media: restoredMedia },
		true
	);
}

describe.skipIf(!enabled)('real PostgreSQL backup recovery (opt-in)', () => {
	it('restores all table rows, relationships and media into two empty independent targets', async () => {
		const urls = connections();
		for (const url of urls) await assertEmptyDatabase(url);
		const clients = urls.map((url) =>
			postgres(url, { max: 1, onnotice: () => undefined, connection: { TimeZone: 'UTC' } })
		);
		const directory = await mkdtemp(join(tmpdir(), 'benchcore-real-recovery-'));
		try {
			const source = clients[0]!;
			const db = drizzle(source, { schema });
			await migrate(db, {
				migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url))
			});
			await seedRecoveryFixture(db);
			const expected = await snapshot(source);
			expect(Object.keys(expected).length).toBeGreaterThanOrEqual(18);
			expect(Object.values(expected).every((rows) => rows.length > 0)).toBe(true);
			for (const [index, backend] of (['local', 'database'] as const).entries()) {
				const target = clients[index + 1]!;
				await recoverBackend(source, target, [urls[0]!, urls[index + 1]!], directory, backend);
				expect(await snapshot(target)).toEqual(expected);
				await expect(assertEmptyDatabase(urls[index + 1]!)).rejects.toThrow();
			}
		} finally {
			await Promise.all(clients.map((sql) => sql.end({ timeout: 5 })));
			await rm(directory, { recursive: true, force: true });
		}
	}, 120_000);
});
