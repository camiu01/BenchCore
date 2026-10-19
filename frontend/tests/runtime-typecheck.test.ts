/**
 * @file runtime-typecheck.test.ts
 * @brief Runtime checks must pass in a checkout without compiled API or frontend output.
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('typechecks runtime and operator scripts without build artifacts', async () => {
	const root = fileURLToPath(new URL('../../', import.meta.url));
	const directory = await mkdtemp(join(tmpdir(), 'benchcore-typecheck-'));
	try {
		await cp(join(root, 'runtime'), join(directory, 'runtime'), { recursive: true });
		await cp(join(root, 'scripts'), join(directory, 'scripts'), { recursive: true });
		await mkdir(join(directory, 'api'));
		await mkdir(join(directory, 'frontend'));
		await cp(join(root, 'frontend/runtime.mjs'), join(directory, 'frontend/runtime.mjs'));
		await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'junction');
		await symlink(join(root, 'api/node_modules'), join(directory, 'api/node_modules'), 'junction');
		const result = spawnSync(
			process.execPath,
			[
				join(root, 'api/node_modules/typescript/bin/tsc'),
				'-p',
				join(directory, 'runtime/tsconfig.json')
			],
			{ encoding: 'utf8', stdio: 'pipe' }
		);
		expect(result.status, `${result.stdout}${result.stderr}${result.error ?? ''}`).toBe(0);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}, 30_000);
