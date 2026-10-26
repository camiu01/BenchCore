/**
 * @file backup.test.ts
 * @brief Isolated archive integrity, key preservation, empty-target and failure-policy regressions.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	exportBackup,
	restoreBackup,
	verifyBackup,
	type BackupOptions
} from '../src/backup/service.js';
import { createBackupDatabase, postgresEnvironment } from '../src/backup/postgres.js';
import { createLocalStorage } from '../src/media/storage.js';

const directories: string[] = [];

/** @brief Builds source images, a new backup path and a simulated native database adapter. @return Isolated backup dependencies. */
async function fixture(): Promise<BackupOptions> {
	const root = await mkdtemp(join(tmpdir(), 'benchcore-backup-'));
	directories.push(root);
	const media = createLocalStorage(join(root, 'source-media'));
	await media.save(Buffer.from('private image bytes'), 'image.png', 'image/png');
	return {
		directory: join(root, 'archive'),
		backend: 'local',
		appVersion: '0.8.0',
		maintenance: true,
		media,
		database: {
			dump: vi.fn(async (file) => {
				await writeFile(file, 'PGDMP simulated native dump');
			}),
			assertEmpty: vi.fn(async () => undefined),
			restore: vi.fn(async () => undefined)
		}
	};
}

/** @brief Supplies an empty independent media target while retaining archive metadata. @param source Export fixture. @return Restore fixture. */
function target(source: BackupOptions): BackupOptions {
	return { ...source, media: createLocalStorage(join(source.directory, '..', 'restored-media')) };
}

afterEach(async () => {
	await Promise.all(
		directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))
	);
});

describe('offline backup archive', () => {
	it('round-trips image keys, metadata and bytes into independent empty storage', async () => {
		const source = await fixture();
		const manifest = await exportBackup(source);
		expect(await verifyBackup(source)).toEqual(manifest);
		const destination = target(source);
		expect(await restoreBackup(destination, true)).toEqual(manifest);
		expect(await destination.media.list({ strict: true })).toEqual(await source.media.list());
		const key = manifest.media[0]!.key;
		expect(await destination.media.load(key)).toEqual(await source.media.load(key));
		expect(source.database.restore).toHaveBeenCalledWith(join(source.directory, 'database.dump'));
		expect(JSON.stringify(manifest)).not.toMatch(/password|postgresql|secret/i);
	});

	it('requires maintenance and refuses an existing export directory', async () => {
		const options = await fixture();
		await expect(exportBackup({ ...options, maintenance: false })).rejects.toThrow();
		expect(options.database.dump).not.toHaveBeenCalled();
		await exportBackup(options);
		await expect(exportBackup(options)).rejects.toThrow();
		expect(options.database.dump).toHaveBeenCalledOnce();
	});

	it.each(['database', 'media'] as const)(
		'rejects tampered %s bytes before any target side effects',
		async (kind) => {
			const source = await fixture();
			const manifest = await exportBackup(source);
			const file =
				kind === 'database'
					? join(source.directory, 'database.dump')
					: join(source.directory, 'media', manifest.media[0]!.key);
			await writeFile(file, 'tampered');
			const destination = target(source);
			await expect(restoreBackup(destination, true)).rejects.toThrow();
			expect(source.database.assertEmpty).not.toHaveBeenCalled();
			expect(source.database.restore).not.toHaveBeenCalled();
			expect(await destination.media.list()).toEqual([]);
		}
	);

	it('rejects unsupported formats, duplicate keys and traversal before writing a target', async () => {
		const options = await fixture();
		const manifest = await exportBackup(options);
		for (const changed of [
			{ ...manifest, format: 'unknown' },
			{ ...manifest, media: [...manifest.media, ...manifest.media] },
			{ ...manifest, media: [{ ...manifest.media[0], key: '../escape.png' }] }
		]) {
			await writeFile(join(options.directory, 'manifest.json'), JSON.stringify(changed));
			await expect(restoreBackup(target(options), true)).rejects.toThrow();
		}
		expect(options.database.restore).not.toHaveBeenCalled();
	});

	it('refuses unexpected entries and storage/version mismatches', async () => {
		const options = await fixture();
		await exportBackup(options);
		await expect(verifyBackup({ ...options, backend: 'r2' })).rejects.toThrow();
		await expect(verifyBackup({ ...options, appVersion: '9.9.9' })).rejects.toThrow();
		await writeFile(join(options.directory, 'unexpected'), 'x');
		await expect(verifyBackup(options)).rejects.toThrow();
	});

	it('rejects malformed or orphaned local metadata rather than silently omitting it', async () => {
		const options = await fixture();
		const [record] = await options.media.list();
		const mediaRoot = join(options.directory, '..', 'source-media');
		await writeFile(join(mediaRoot, `${record!.key}.json`), '{broken');
		await expect(exportBackup(options)).rejects.toThrow();
		await expect(readFile(join(options.directory, 'manifest.json'))).rejects.toThrow();
	});

	it('leaves no completed manifest when the native database dump fails', async () => {
		const options = await fixture();
		vi.mocked(options.database.dump).mockRejectedValue(new Error('simulated failure'));
		await expect(exportBackup(options)).rejects.toThrow();
		await expect(readFile(join(options.directory, 'manifest.json'))).rejects.toThrow();
	});

	it('requires trusted provenance and maintenance before inspecting a target', async () => {
		const options = await fixture();
		await exportBackup(options);
		await expect(restoreBackup(target(options), false)).rejects.toThrow();
		await expect(restoreBackup({ ...target(options), maintenance: false }, true)).rejects.toThrow();
		expect(options.database.assertEmpty).not.toHaveBeenCalled();
	});

	it('never changes a populated database or populated media target', async () => {
		const options = await fixture();
		await exportBackup(options);
		vi.mocked(options.database.assertEmpty).mockRejectedValueOnce(new Error('not empty'));
		await expect(restoreBackup(target(options), true)).rejects.toThrow('not empty');
		await expect(restoreBackup(options, true)).rejects.toThrow('Media target must be empty');
		expect(options.database.restore).not.toHaveBeenCalled();
	});

	it('refuses replacement of an existing managed image key', async () => {
		const options = await fixture();
		const [record] = await options.media.list();
		await expect(
			options.media.restore!(record!, Buffer.alloc(record!.sizeBytes))
		).rejects.toThrow();
		expect((await options.media.load(record!.key))?.data.toString()).toBe('private image bytes');
	});

	it('reports restore failure without deleting isolated partial media or the backup', async () => {
		const options = await fixture();
		await exportBackup(options);
		const destination = target(options);
		vi.mocked(options.database.restore).mockRejectedValue(new Error('transaction failed'));
		await expect(restoreBackup(destination, true)).rejects.toThrow('transaction failed');
		expect(await destination.media.list()).toHaveLength(1);
		await expect(restoreBackup(destination, true)).rejects.toThrow('Media target must be empty');
		await expect(verifyBackup(options)).resolves.toBeDefined();
	});

	it('verifies database-mode media after native restore instead of generating replacement keys', async () => {
		const options = { ...(await fixture()), backend: 'database' as const };
		await exportBackup(options);
		const original = options.media;
		const restored = target(options);
		vi.mocked(options.database.restore).mockImplementation(async () => {
			restored.media = original;
		});
		await expect(restoreBackup(restored, true)).resolves.toBeDefined();
		expect(options.database.assertEmpty).toHaveBeenCalledOnce();
	});
});

describe('native PostgreSQL adapter', () => {
	it('keeps credentials and unrelated secrets out of command arguments and child environment', async () => {
		const run = vi.fn(async () => undefined);
		const empty = vi.fn(async () => undefined);
		const db = createBackupDatabase(
			'postgresql://owner:private%40value@localhost:5433/recovery_test?sslmode=verify-full',
			run,
			empty
		);
		await db.dump('private.dump');
		await db.restore('private.dump');
		const calls = run.mock.calls as unknown as [string, string[], NodeJS.ProcessEnv][];
		expect(calls[0]![1]).toContain('--format=custom');
		expect(calls[1]![1]).toContain('--single-transaction');
		expect(calls[1]![1]).not.toContain('--clean');
		expect(JSON.stringify(calls.map((call) => call[1]))).not.toContain('private@value');
		expect(calls[0]![2]['PGPASSWORD']).toBe('private@value');
		expect(calls[0]![2]['PGSSLMODE']).toBe('verify-full');
		expect(empty).toHaveBeenCalledOnce();
	});

	it('rejects non-PostgreSQL URLs and unsupported connection options', () => {
		expect(() => postgresEnvironment('https://db.example/test')).toThrow();
		expect(() => postgresEnvironment('postgresql://db.example/test?host=other.example')).toThrow();
		expect(() =>
			postgresEnvironment('postgresql://db.example/test?sslrootcert=custom.pem')
		).toThrow();
		expect(
			postgresEnvironment('postgresql://db.example/test?sslmode=verify-full&sslrootcert=system')
		).toMatchObject({ PGSSLMODE: 'verify-full', PGSSLROOTCERT: 'system' });
		const env = postgresEnvironment('postgresql://user@[::1]/recovery_test', {
			SMTP_PASS: 'unrelated',
			PGPASSWORD: 'stale',
			PGHOST: 'stale',
			PATH: 'path-only'
		});
		expect(env).toMatchObject({ PGHOST: '::1', PGDATABASE: 'recovery_test', PATH: 'path-only' });
		expect(env['PGPASSWORD']).toBeUndefined();
		expect(env['SMTP_PASS']).toBeUndefined();
	});
});
