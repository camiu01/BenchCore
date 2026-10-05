/**
 * @file package-beta.mjs
 * @brief Assembles an allowlisted production bundle with isolated, production-only dependencies.
 */
import { cp, mkdir, readFile, readdir, realpath, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPackageStaging, createBundleDirectory, createDependencyWorkspace, deploymentArguments } from './package-layout.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

/**
 * @brief Runs the exact pnpm executable that launched this script.
 * @param {string[]} args Package manager arguments.
 * @param {string} workspace Isolated dependency workspace.
 * @return {void} Completion.
 */
function pnpm(args, workspace) {
	const executable = process.env['npm_execpath'];
	if (!executable || !executable.includes('pnpm')) { throw new Error('Run with pnpm beta:package'); }
	execFileSync(process.execPath, [executable, ...args], { cwd: workspace, stdio: 'inherit' });
}

/**
 * @brief Copies only approved application paths, never authoring content or environment files.
 * @param {string} bundle Destination.
 * @param {string} temporary Isolated deployment dependency directory.
 * @param {string} destination Final application directory.
 * @return {Promise<void>} Completion.
 */
async function assemble(bundle, temporary, destination) {
	const workspace = await createDependencyWorkspace(root, temporary);
	for (const name of ['api', 'frontend']) {
		const deployed = join(temporary, `${name}-dependencies`);
		pnpm(deploymentArguments(name, deployed), workspace);
		await mkdir(join(bundle, name), { recursive: true });
		await cp(join(deployed, 'node_modules'), join(bundle, name, 'node_modules'), {
			recursive: true, verbatimSymlinks: true,
			filter: (path) => !['.bin', '.modules.yaml', '.pnpm-workspace-state-v1.json',
				'benchcore-api', 'benchcore-frontend', 'blog-api', 'blog-frontend'].includes(basename(path))
		});
		await fixLinks(join(bundle, name, 'node_modules'), join(deployed, 'node_modules'),
			join(bundle, name, 'node_modules'), join(destination, name, 'node_modules'));
		await cp(join(root, name, 'package.json'), join(bundle, name, 'package.json'));
	}
	for (const relative of ['api/dist', 'api/drizzle', 'frontend/build']) {
		await cp(join(root, relative), join(bundle, relative), { recursive: true });
	}
	await mkdir(join(bundle, 'runtime'));
	for (const name of ['server', 'settings', 'router', 'bridge']) {
		await cp(join(root, 'runtime', `${name}.mjs`), join(bundle, 'runtime', `${name}.mjs`));
	}
	for (const relative of ['frontend/runtime.mjs', '.env.production.example', 'LICENSE', 'CHANGELOG.md']) {
		await cp(join(root, relative), join(bundle, relative));
	}
	await cp(join(root, 'docs', 'BETA_DEPLOYMENT.md'), join(bundle, 'README.md'));
}

/**
 * @brief Rehomes pnpm links inside the bundle, rejecting targets outside its dependency store.
 * @param {string} directory Copied directory.
 * @param {string} source Original isolated dependency directory.
 * @param {string} copied Copied dependency root.
 * @param {string} final Final dependency root (Windows junctions must use absolute targets).
 * @return {Promise<void>} Completion.
 */
async function fixLinks(directory, source, copied, final) {
	source = await realpath(source);
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isSymbolicLink()) {
			const original = join(source, relative(copied, path));
			const target = await realpath(original);
			const suffix = relative(source, target);
			if (suffix.startsWith('..')) { throw new Error('Dependency link escaped the isolated store'); }
			await unlink(path);
			const windows = process.platform === 'win32';
			await symlink(windows ? join(final, suffix) : relative(dirname(path), join(copied, suffix)),
				path, windows ? 'junction' : 'dir');
		} else if (entry.isDirectory()) {
			await fixLinks(path, source, copied, final);
		}
	}
}

/**
 * @brief Produces a versioned directory without overwriting an existing artifact.
 * @return {Promise<void>} Completion.
 */
async function main() {
	for (const relative of ['api/dist/cli/migrate.js', 'frontend/build/handler.js']) {
		if (!existsSync(join(root, relative))) { throw new Error('Run pnpm build first'); }
	}
	const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
	if (!/^\d+\.\d+\.\d+-beta\.\d+$/.test(manifest.version)) { throw new Error('A beta semver is required'); }
	const artifacts = join(root, 'artifacts');
	await mkdir(artifacts, { recursive: true });
	const destination = join(artifacts, `benchcore-${manifest.version}`);
	if (existsSync(destination)) { throw new Error('Versioned artifact already exists'); }
	const temporary = await createPackageStaging(artifacts);
	/** @type {string | undefined} */
	let bundle;
	try {
		bundle = await createBundleDirectory(temporary, destination);
		await assemble(bundle, temporary, destination);
		const scripts = {
			start: 'node --env-file-if-exists=.env runtime/server.mjs',
			'db:migrate': 'node --env-file-if-exists=.env api/dist/cli/migrate.js',
			'user:create': 'node --env-file-if-exists=.env api/dist/cli/account.js create',
			'user:password': 'node --env-file-if-exists=.env api/dist/cli/account.js password'
		};
		await writeFile(join(bundle, 'package.json'), JSON.stringify({
			name: manifest.name, version: manifest.version, private: true,
			license: manifest.license, type: 'module', engines: { node: '>=24 <25' }, scripts
		}, null, '\t') + '\n');
		if (bundle !== destination) { await rename(bundle, destination); }
		process.stdout.write(`BenchCore beta bundle: artifacts/benchcore-${manifest.version}\n`);
	} catch (error) {
		if (bundle === destination) { await rm(bundle, { recursive: true, force: true }); }
		throw error;
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
}

main().catch((error) => {
	const kind = error instanceof Error ? error.name : 'unknown';
	const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'no code';
	process.stderr.write(`Beta packaging failed (${kind}, ${code}); check builds, pnpm and whether this version already exists\n`);
	process.exitCode = 1;
});
