/**
 * @file postgres.ts
 * @brief Native PostgreSQL archives with private connection environment and atomic restore.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assertEmptyDatabase } from '../db/backup.js';
import type { BackupDatabase } from './manifest.js';

const execute = promisify(execFile);
const connectionOptions: Record<string, string> = {
	sslmode: 'PGSSLMODE',
	sslrootcert: 'PGSSLROOTCERT',
	connect_timeout: 'PGCONNECT_TIMEOUT',
	application_name: 'PGAPPNAME',
	target_session_attrs: 'PGTARGETSESSIONATTRS'
};

/** @brief Converts an explicit TCP PostgreSQL URL without placing credentials in process arguments. @param value Source or target URL. @param inherited Minimal native execution environment. @return Private libpq environment. */
export function postgresEnvironment(
	value: string,
	inherited: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
	const url = new URL(value);
	if (
		!['postgres:', 'postgresql:'].includes(url.protocol) ||
		!url.hostname ||
		url.pathname.length < 2
	) {
		throw new Error('A TCP PostgreSQL database URL is required');
	}
	const env: NodeJS.ProcessEnv = {};
	for (const key of [
		'PATH',
		'Path',
		'SystemRoot',
		'WINDIR',
		'HOME',
		'USERPROFILE',
		'APPDATA',
		'TEMP',
		'TMP'
	]) {
		if (inherited[key] !== undefined) env[key] = inherited[key];
	}
	Object.assign(env, {
		PGHOST: url.hostname.replace(/^\[|\]$/g, ''),
		PGPORT: url.port || '5432',
		PGUSER: decodeURIComponent(url.username),
		PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
		PGCONNECT_TIMEOUT: '10',
		PGAPPNAME: 'benchcore-backup'
	});
	if (url.password) env['PGPASSWORD'] = decodeURIComponent(url.password);
	for (const [key, parameter] of url.searchParams) {
		const name = connectionOptions[key];
		if (!name || (key === 'sslrootcert' && parameter !== 'system')) {
			throw new Error('Unsupported PostgreSQL backup connection option');
		}
		env[name] = parameter;
	}
	return env;
}

/** @brief Executes a native client without a shell, interactive prompts or credential-bearing diagnostics. @param command Client name on PATH. @param args Non-secret arguments. @param env Private connection environment. @return Completion. */
export async function runPostgres(
	command: string,
	args: string[],
	env: NodeJS.ProcessEnv
): Promise<void> {
	try {
		await execute(command, args, {
			env,
			timeout: 30 * 60_000,
			maxBuffer: 64 * 1024,
			windowsHide: true
		});
	} catch {
		throw new Error(
			'PostgreSQL backup command failed; check client installation, connectivity and database state'
		);
	}
}

/** @brief Creates full native dump/restore operations for one explicit connection. @param url Private connection URL. @param run Injectable native runner. @param empty Injectable catalog guard. @return Backup database adapter. */
export function createBackupDatabase(
	url: string,
	run = runPostgres,
	empty = assertEmptyDatabase
): BackupDatabase {
	const env = postgresEnvironment(url);
	const database = `dbname='${env['PGDATABASE']!.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
	return {
		/** @brief Dumps all schemas/data, including migrations, sessions and groundwork tables. @param file Private destination. @return Completion. */
		dump: (file) =>
			run(
				'pg_dump',
				[
					'--no-password',
					'--format=custom',
					'--no-owner',
					'--no-privileges',
					'--dbname',
					database,
					'--file',
					file
				],
				env
			),
		/** @brief Refuses a populated recovery target. @return Completion. */
		assertEmpty: () => empty(url),
		/** @brief Restores without dropping objects, in a single transaction. @param file Verified trusted archive. @return Completion. */
		async restore(file) {
			await empty(url);
			await run(
				'pg_restore',
				[
					'--no-password',
					'--no-owner',
					'--no-privileges',
					'--exit-on-error',
					'--single-transaction',
					'--dbname',
					database,
					'--',
					file
				],
				env
			);
		}
	};
}
