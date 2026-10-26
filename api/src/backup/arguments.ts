/**
 * @file arguments.ts
 * @brief Strict command arguments and canonical archive/media separation guards.
 */
import { realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import type { BackupBackend } from './manifest.js';

/** @brief Requires explicit recovery destinations rather than inheriting live database/media locations. @param env Private operator settings. @param backend Target storage mode. @return Copied settings with explicit targets. */
export function restoreEnvironment(
	env: NodeJS.ProcessEnv,
	backend: BackupBackend
): NodeJS.ProcessEnv {
	const target: NodeJS.ProcessEnv = {
		...env,
		DATABASE_URL: z.string().min(1).parse(env['RESTORE_DATABASE_URL'])
	};
	if (backend === 'local') {
		target['MEDIA_DIR'] = z.string().min(1).refine(isAbsolute).parse(env['RESTORE_MEDIA_DIR']);
	}
	if (backend === 'r2') target['R2_BUCKET'] = z.string().min(1).parse(env['RESTORE_R2_BUCKET']);
	return target;
}

/** @brief Parses one explicit action, private path and maintenance acknowledgements. @param args Non-secret command arguments. @return Validated command or help request. */
export function backupArguments(args: string[]) {
	const { values, positionals } = parseArgs({
		args,
		allowPositionals: true,
		options: {
			directory: { type: 'string' },
			maintenance: { type: 'boolean' },
			'trust-backup': { type: 'boolean' },
			help: { type: 'boolean' }
		}
	});
	if (values.help) return { help: true as const };
	if (positionals.length !== 1) throw new Error('One backup action is required');
	const action = z.enum(['export', 'verify', 'restore']).parse(positionals[0]);
	if (
		action !== 'verify' &&
		(!values.maintenance || (action === 'restore' && !values['trust-backup']))
	) {
		throw new Error('Required acknowledgements missing');
	}
	return {
		help: false as const,
		action,
		directory: resolve(z.string().min(1).parse(values.directory))
	};
}

/** @brief Resolves aliases in existing ancestors without creating a destination. @param path Presented absolute path. @return Canonical path including its not-yet-created suffix. */
async function canonicalPath(path: string): Promise<string> {
	try {
		return await realpath(path);
	} catch (error) {
		if (
			!(error instanceof Error) ||
			!('code' in error) ||
			error.code !== 'ENOENT' ||
			dirname(path) === path
		)
			throw error;
		return join(await canonicalPath(dirname(path)), basename(path));
	}
}

/** @brief Rejects overlapping archive/media roots, including directory aliases, before any writes. @param archive Backup root. @param media Local media root. @return Completion. */
export async function disjointPaths(archive: string, media: string): Promise<void> {
	const paths = await Promise.all([canonicalPath(resolve(archive)), canonicalPath(resolve(media))]);
	for (const [parent, child] of [
		[paths[0]!, paths[1]!],
		[paths[1]!, paths[0]!]
	]) {
		const path = relative(parent!, child!);
		if (!path || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path))) {
			throw new Error('Archive and media directories must be separate');
		}
	}
}
