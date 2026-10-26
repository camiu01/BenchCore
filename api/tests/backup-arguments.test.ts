/**
 * @file backup-arguments.test.ts
 * @brief Command intent and canonical path guards run before database/filesystem writes.
 */
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { backupArguments, disjointPaths, restoreEnvironment } from '../src/backup/arguments.js';

const directories: string[] = [];
afterEach(async () => {
	await Promise.all(
		directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))
	);
});

describe('backup operator intent', () => {
	it('never falls back to live database or media locations during recovery', () => {
		const live = {
			DATABASE_URL: 'postgresql://source/source',
			MEDIA_DIR: '/live/media',
			R2_BUCKET: 'live-media'
		};
		expect(() => restoreEnvironment(live, 'database')).toThrow();
		const target = { ...live, RESTORE_DATABASE_URL: 'postgresql://target/target' };
		expect(() => restoreEnvironment(target, 'local')).toThrow();
		expect(() => restoreEnvironment(target, 'r2')).toThrow();
		expect(
			restoreEnvironment(
				{ ...target, RESTORE_MEDIA_DIR: join(tmpdir(), 'isolated-media') },
				'local'
			)
		).toMatchObject({
			DATABASE_URL: target.RESTORE_DATABASE_URL,
			MEDIA_DIR: join(tmpdir(), 'isolated-media')
		});
		expect(
			restoreEnvironment({ ...target, RESTORE_R2_BUCKET: 'isolated-media' }, 'r2')['R2_BUCKET']
		).toBe('isolated-media');
		expect(live).toMatchObject({ MEDIA_DIR: '/live/media', R2_BUCKET: 'live-media' });
	});
	it('accepts help and read-only verification without maintenance acknowledgement', () => {
		expect(backupArguments(['--help'])).toEqual({ help: true });
		expect(backupArguments(['verify', '--directory', 'private-backup'])).toMatchObject({
			action: 'verify',
			directory: resolve('private-backup')
		});
	});
	it.each([
		[],
		['unknown'],
		['export', '--directory', 'private-backup'],
		['restore', '--directory', 'private-backup', '--maintenance'],
		['export', '--directory', 'private-backup', '--maintenance', '--force']
	])('rejects incomplete or unsafe command arguments: %j', (...args) => {
		expect(() => backupArguments(args)).toThrow();
	});
	it('requires both acknowledgements and an explicit path for recovery', () => {
		expect(
			backupArguments([
				'restore',
				'--directory',
				'private-backup',
				'--maintenance',
				'--trust-backup'
			])
		).toMatchObject({ action: 'restore' });
		expect(() => backupArguments(['restore', '--maintenance', '--trust-backup'])).toThrow();
	});
	it('rejects same/nested paths including aliases and dot-prefixed directory names', async () => {
		const root = await mkdtemp(join(tmpdir(), 'benchcore-backup-paths-'));
		directories.push(root);
		const media = join(root, 'media');
		await mkdir(media);
		await symlink(
			media,
			join(root, 'media-alias'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		await expect(disjointPaths(media, media)).rejects.toThrow();
		await expect(disjointPaths(join(media, '..snapshot'), media)).rejects.toThrow();
		await expect(disjointPaths(join(root, 'media-alias', 'snapshot'), media)).rejects.toThrow();
		await expect(disjointPaths(root, media)).rejects.toThrow();
		await expect(disjointPaths(join(root, 'backup'), media)).resolves.toBeUndefined();
	});
});
