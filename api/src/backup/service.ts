/**
 * @file service.ts
 * @brief Coordinated offline backup and empty-target-only recovery through storage/database seams.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mediaRecord, type StorageProvider } from '../media/storage.js';
import { customDump, fingerprint, plainFile, readManifest } from './files.js';
import {
	manifestSchema,
	type BackupBackend,
	type BackupDatabase,
	type BackupManifest
} from './manifest.js';

export interface BackupOptions {
	directory: string;
	backend: BackupBackend;
	appVersion: string;
	maintenance: boolean;
	database: BackupDatabase;
	media: StorageProvider;
}

/** @brief Verifies bounded media bytes and metadata, preserving original managed keys. @param directory Archive root. @param item Manifest record. @return Verified image bytes. */
async function imageBytes(
	directory: string,
	item: BackupManifest['media'][number]
): Promise<Buffer> {
	const file = join(directory, 'media', item.key);
	if ((await plainFile(file, item.sizeBytes)) !== item.sizeBytes)
		throw new Error('Media length mismatch');
	const data = await readFile(file);
	if (createHash('sha256').update(data).digest('hex') !== item.sha256)
		throw new Error('Media checksum mismatch');
	return data;
}

/** @brief Exports every valid completed managed image; corrupt or inaccessible inventory fails closed. @param options Explicit offline export configuration. @return Media manifest. */
async function exportMedia(options: BackupOptions): Promise<BackupManifest['media']> {
	const records = await options.media.list({ strict: true });
	if (records.length > 100_000) throw new Error('Too many media records');
	const entries: BackupManifest['media'] = [];
	for (const value of records) {
		const record = mediaRecord.parse(value);
		const file = await options.media.load(record.key);
		if (!file || file.mime !== record.mime || file.data.length !== record.sizeBytes)
			throw new Error('Unreadable media');
		const sha256 = createHash('sha256').update(file.data).digest('hex');
		await writeFile(join(options.directory, 'media', record.key), file.data, {
			flag: 'wx',
			mode: 0o600
		});
		entries.push({ ...record, sha256 });
	}
	return entries;
}

/** @brief Creates a new private backup, writing its manifest only after all components succeed. @param options Operator-selected offline backup configuration. @return Verified backup metadata. */
export async function exportBackup(options: BackupOptions): Promise<BackupManifest> {
	if (!options.maintenance) throw new Error('Stop all writers and acknowledge maintenance');
	await mkdir(options.directory, { mode: 0o700 });
	await mkdir(join(options.directory, 'media'), { mode: 0o700 });
	const dump = join(options.directory, 'database.dump');
	await writeFile(dump, '', { flag: 'wx', mode: 0o600 });
	await options.database.dump(dump);
	await customDump(dump);
	const manifest = manifestSchema.parse({
		format: 'benchcore-backup-v1',
		appVersion: options.appVersion,
		createdAt: new Date().toISOString(),
		backend: options.backend,
		database: await fingerprint(dump),
		media: await exportMedia(options)
	});
	const serialized = JSON.stringify(manifest, null, '\t') + '\n';
	if (Buffer.byteLength(serialized) > 64 * 1024 * 1024)
		throw new Error('Backup manifest is too large');
	await writeFile(join(options.directory, 'manifest.json'), serialized, {
		flag: 'wx',
		mode: 0o600
	});
	return manifest;
}

/** @brief Validates all archive bytes before any restore side effect. @param options Restore target metadata. @return Validated manifest. */
export async function verifyBackup(
	options: Pick<BackupOptions, 'directory' | 'backend' | 'appVersion'>
): Promise<BackupManifest> {
	const manifest = await readManifest(options.directory);
	if (manifest.backend !== options.backend || manifest.appVersion !== options.appVersion) {
		throw new Error('Restore requires the same storage backend and application version');
	}
	const dump = join(options.directory, 'database.dump');
	const actual = await fingerprint(dump);
	if (
		actual.sha256 !== manifest.database.sha256 ||
		actual.sizeBytes !== manifest.database.sizeBytes
	) {
		throw new Error('Database checksum mismatch');
	}
	await customDump(dump);
	for (const item of manifest.media) await imageBytes(options.directory, item);
	return manifest;
}

/** @brief Verifies restored storage against every original managed key and byte digest. @param options Restore dependencies. @param manifest Verified inventory. @return Completion. */
async function verifyRestoredMedia(
	options: BackupOptions,
	manifest: BackupManifest
): Promise<void> {
	const records = await options.media.list({ strict: true });
	if (records.length !== manifest.media.length) throw new Error('Restored inventory mismatch');
	const byKey = new Map(records.map((record) => [record.key, record]));
	for (const item of manifest.media) {
		const record = byKey.get(item.key);
		const bytes = await options.media.load(item.key);
		if (
			!record ||
			!bytes ||
			record.filename !== item.filename ||
			record.mime !== item.mime ||
			record.sizeBytes !== item.sizeBytes ||
			bytes.mime !== item.mime ||
			bytes.data.length !== item.sizeBytes ||
			createHash('sha256').update(bytes.data).digest('hex') !== item.sha256
		) {
			throw new Error('Restored media verification failed');
		}
	}
}

/** @brief Restores only to empty isolated state; cross-system failure leaves isolated partial media, never overwritten state. @param options Explicit target configuration. @param trustBackup Acknowledges trusted SQL archive provenance. @return Restored metadata after verification. */
export async function restoreBackup(
	options: BackupOptions,
	trustBackup: boolean
): Promise<BackupManifest> {
	if (!options.maintenance || !trustBackup)
		throw new Error('Maintenance and trusted-backup acknowledgement required');
	const manifest = await verifyBackup(options);
	await options.database.assertEmpty();
	if (options.backend !== 'database') {
		if ((await options.media.list({ strict: true })).length)
			throw new Error('Media target must be empty');
		if (!options.media.restore) throw new Error('Storage cannot preserve restored keys');
		for (const item of manifest.media) {
			await options.media.restore(
				mediaRecord.parse(item),
				await imageBytes(options.directory, item)
			);
		}
	}
	await options.database.restore(join(options.directory, 'database.dump'));
	await verifyRestoredMedia(options, manifest);
	return manifest;
}
