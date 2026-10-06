/**
 * @file dev-script.test.ts
 * @brief Dev command argument ordering and environment loading without application boot.
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const require = createRequire(import.meta.url);
const manifestSchema = z.object({ scripts: z.object({ dev: z.string() }) });

/** @brief Stops only the watcher created by this test. @param child Test watcher. @return Nothing. */
function stopWatcher(child: ChildProcess): void {
	if (!child.pid || child.exitCode !== null) return;
	if (process.platform === 'win32') {
		execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
		return;
	}
	child.kill('SIGTERM');
}

/** @brief Waits for the fixture marker, failing on startup errors or timeout. @param child Test watcher. @return Captured output. */
function watcherOutput(child: ChildProcess): Promise<string> {
	return new Promise((resolve, reject) => {
		let output = '';
		const timer = setTimeout(() => reject(new Error('Watcher startup timed out')), 8000);
		child.stdout?.on('data', (chunk: Buffer) => {
			output += chunk.toString();
			if (!output.includes('WATCH_ENV_READY:loaded')) return;
			clearTimeout(timer);
			resolve(output);
		});
		child.once('error', (error) => { clearTimeout(timer); reject(error); });
		child.once('exit', (code) => {
			clearTimeout(timer);
			reject(new Error(`Watcher exited before fixture output: ${code}`));
		});
	});
}

describe('API development script', () => {
	it('recognizes watch before passing Node flags and loads the environment file', async () => {
		const manifest = manifestSchema.parse(JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')));
		const [runner, ...args] = manifest.scripts.dev.split(' ');
		expect(runner).toBe('tsx');
		expect(args).toEqual(['watch', '--env-file-if-exists=../.env', 'src/index.ts']);
		const directory = await mkdtemp(join(tmpdir(), 'benchcore-watch-'));
		let child: ChildProcess | undefined;
		try {
			const env = join(directory, 'fixture.env');
			const entry = join(directory, 'fixture.ts');
			await writeFile(env, 'BENCHCORE_WATCH_SMOKE=loaded\n');
			await writeFile(entry, 'const marker: string = process.env["BENCHCORE_WATCH_SMOKE"] ?? ""; console.log(`WATCH_ENV_READY:${marker}`); process.exit(0);\n');
			const fixtureArgs = args.map((arg) => arg.startsWith('--env-file-if-exists=')
				? `--env-file-if-exists=${env}` : arg === 'src/index.ts' ? entry : arg);
			child = spawn(process.execPath, [require.resolve('tsx/cli'), ...fixtureArgs], {
				cwd: directory, stdio: ['ignore', 'pipe', 'ignore']
			});
			expect(await watcherOutput(child)).toContain('WATCH_ENV_READY:loaded');
		} finally {
			if (child) stopWatcher(child);
			await rm(directory, { recursive: true, force: true });
		}
	}, 15_000);
});
