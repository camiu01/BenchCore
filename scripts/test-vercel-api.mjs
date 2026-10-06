/**
 * @file test-vercel-api.mjs
 * @brief Builds and loads the real Vercel API artifact without cloud credentials or database access.
 */
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pnpmInvocation } from './pnpm-invocation.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const pnpm = process.env['npm_execpath'] ?? '';
assert(pnpm.includes('pnpm'), 'Run this check with pnpm test:vercel-api');
const storeInvocation = pnpmInvocation(pnpm, ['store', 'path', '--silent']);
const store = execFileSync(storeInvocation.command, storeInvocation.args,
	{ cwd: root, encoding: 'utf8' }).trim();
assert(isAbsolute(store), 'The original pnpm store must have an absolute path');

/**
 * @brief Removes inherited application credentials before loading build tooling.
 * @return Nothing.
 */
function isolateEnvironment() {
	const allowed = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'USERPROFILE',
		'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'HOME']);
	for (const key of Object.keys(process.env)) {
		if (!allowed.has(key.toUpperCase())) { delete process.env[key]; }
	}
	Object.assign(process.env, { NODE_ENV: 'production', VERCEL: '1',
		VERCEL_TELEMETRY_DISABLED: '1', SITE_URL: 'https://fixture.example.test' });
}

/**
 * @brief Copies source/config only; existing standalone output must not enter the build.
 * @param {string} fixture Owned temporary directory.
 * @return Fixture API path.
 */
async function createFixture(fixture) {
	const api = join(fixture, 'api');
	await mkdir(api);
	for (const name of ['package.json', 'src', 'scripts/build-vercel.mjs', 'tsconfig.json', 'tsconfig.build.json']) {
		await mkdir(dirname(join(api, name)), { recursive: true });
		await cp(join(root, 'api', name), join(api, name), { recursive: true });
	}
	for (const name of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) {
		await cp(join(root, name), join(fixture, name));
	}
	const storeCommand = pnpmInvocation(pnpm, ['store', 'path', '--silent', '--store-dir', store]);
	const fixtureStore = execFileSync(storeCommand.command, storeCommand.args,
		{ cwd: fixture, encoding: 'utf8' }).trim();
	assert.equal(fixtureStore, store, 'Environment isolation must not change the offline package store');
	const install = pnpmInvocation(pnpm, ['install', '--offline', '--frozen-lockfile', '--ignore-scripts',
		'--prod=false', '--store-dir', store]);
	execFileSync(install.command, install.args,
		{ cwd: fixture, env: { ...process.env, CI: '1' }, stdio: 'inherit' });
	return api;
}

/**
 * @brief Materializes only the builder's function files, refusing traversal.
 * @param {Parameters<typeof import('@vercel/backends').build>[0]['files']} files Function file map from Vercel.
 * @param {string} output Owned artifact directory.
 * @return Nothing.
 */
async function materialize(files, output) {
	for (const [name, file] of Object.entries(files)) {
		assert(file.type === 'FileFsRef' || file.type === 'FileBlob', 'Unexpected function file reference');
		const target = resolve(output, name);
		const path = relative(output, target);
		assert(!isAbsolute(path) && !path.startsWith(`..${sep}`) && path !== '' && path !== '..',
			'Function file escapes artifact directory');
		await mkdir(dirname(target), { recursive: true });
		const bytes = file.type === 'FileFsRef' ? await readFile(file.fsPath) : file.data;
		assert(bytes !== undefined, `Unsupported function file type: ${file.type}`);
		await writeFile(target, bytes);
	}
}

/**
 * @brief Builds with the configured production command and loads the actual lambda entrypoint.
 * @param {string} fixture Owned temporary directory.
 * @return Nothing.
 */
async function verify(fixture) {
	const api = await createFixture(fixture);
	const service = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8')).services.api;
	const { build } = await import('@vercel/backends');
	const result = await build({ files: {}, workPath: api, repoRootPath: fixture,
		entrypoint: service.entrypoint, meta: { skipDownload: true },
		config: { serviceName: 'api', projectSettings: {
			installCommand: '', buildCommand: service.buildCommand, nodeVersion: '24.x'
		} }, service: { name: 'api', type: 'web' } });
	assert.equal(await readFile(join(api, 'dist/index.js')).catch(() => null), null,
		'Vercel build emitted standalone dist/index.js');
	assert('output' in result);
	const lambdas = Object.values(result.output).filter((file) => file.type === 'Lambda');
	assert.equal(lambdas.length, 1);
	const lambda = lambdas[0];
	assert(lambda?.files);
	assert.equal(lambda.runtime, 'nodejs24.x');
	assert.equal(lambda.handler, 'index.mjs', 'Production artifact must use the explicit ESM bundle');
	assert(!Object.keys(lambda.files).some((name) => name.includes('node_modules')),
		'Self-contained API bundle must not depend on traced package links');
	const output = join(fixture, 'artifact');
	await materialize(lambda.files, output);
	await writeFile(join(output, 'package.json'), JSON.stringify({ type: 'commonjs' }));
	const module = await import(pathToFileURL(join(output, lambda.handler)).href);
	assert.equal(typeof module.default?.fetch, 'function', 'Packaged Fetch entrypoint is missing');
	const live = await module.default.fetch(new Request('https://fixture.example.test/health/live'));
	assert.equal(live.status, 200);
	assert.deepEqual(await live.json(), { status: 'ok' });
	const unavailable = await module.default.fetch(new Request('https://fixture.example.test/api/posts'));
	assert.equal(unavailable.status, 503, 'Missing database configuration must fail lazily');
	console.log('PASS: real Vercel API artifact loads, serves liveness and never starts the standalone server');
}

isolateEnvironment();
const fixture = await realpath(await mkdtemp(join(tmpdir(), 'benchcore-vercel-api-')));
try {
	await verify(fixture);
} finally {
	await rm(fixture, { recursive: true, force: true });
}
