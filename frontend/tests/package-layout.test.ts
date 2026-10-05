/**
 * @file package-layout.test.ts
 * @brief Writable isolated dependency workspaces for legacy pnpm packaging.
 */
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	createPackageStaging,
	createBundleDirectory,
	createDependencyWorkspace,
	deploymentArguments
} from '../../scripts/package-layout.mjs';

describe('beta package deployment paths', () => {
	it('reserves Windows final paths without replacing releases and stages Linux bundles', async () => {
		const root = await mkdtemp(join(tmpdir(), 'benchcore-reservation-test-'));
		const destination = join(root, 'release');
		try {
			expect(await createBundleDirectory(root, destination, 'win32')).toBe(destination);
			await writeFile(join(destination, 'marker'), 'keep');
			await expect(createBundleDirectory(root, destination, 'win32')).rejects.toMatchObject({
				code: 'EEXIST'
			});
			expect(await readFile(join(destination, 'marker'), 'utf8')).toBe('keep');
			expect(await createBundleDirectory(root, destination, 'linux')).toBe(join(root, 'bundle'));
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
	it('keeps Node delivery without Docker deployment files or commands', async () => {
		const manifest = JSON.parse(
			await readFile(new URL('../../package.json', import.meta.url), 'utf8')
		);
		expect(Object.keys(manifest.scripts).some((name) => name.startsWith('docker:'))).toBe(false);
		expect(manifest.scripts.start).toBe('node --env-file-if-exists=.env runtime/server.mjs');
		for (const file of [
			'.dockerignore',
			'docker-compose.yml',
			'api/Dockerfile',
			'frontend/Dockerfile'
		]) {
			await expect(access(new URL(`../../${file}`, import.meta.url))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		}
	});
	it('creates unique writable staging under artifacts and preserves existing releases', async () => {
		const root = await mkdtemp(join(tmpdir(), 'benchcore-layout-test-'));
		const artifacts = join(root, 'artifacts');
		try {
			const first = await createPackageStaging(artifacts);
			await writeFile(join(artifacts, 'existing-release'), 'keep');
			const second = await createPackageStaging(artifacts);
			expect(first.startsWith(join(artifacts, '.benchcore-beta-'))).toBe(true);
			expect(second).not.toBe(first);
			expect(await readdir(artifacts)).toContain('existing-release');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
	it('contains the legacy Linux bin resolution within owned staging', () => {
		const checkout = '/home/runner/work/BenchCore/BenchCore';
		const staging = posix.join(checkout, 'artifacts/.benchcore-beta-fixture');
		const workspace = posix.join(staging, 'workspace');
		const deployed = posix.join(staging, 'api-dependencies');
		const modules = posix.relative(workspace, posix.join(deployed, 'node_modules'));
		const bins = posix.resolve(workspace, 'api', modules, '.bin');
		expect(posix.relative(staging, bins).startsWith('..')).toBe(false);
		expect(bins).not.toMatch(/^\/home\/tmp(?:\/|$)/);
		const args = deploymentArguments('api', deployed);
		expect(args).toEqual(['--filter', 'benchcore-api', 'deploy', '--legacy', '--prod', deployed]);
	});
	it('copies dependency metadata only, never environment files or authoring content', async () => {
		const root = await mkdtemp(join(tmpdir(), 'benchcore-workspace-test-'));
		try {
			const workspace = await createDependencyWorkspace(
				fileURLToPath(new URL('../../', import.meta.url)),
				root
			);
			expect((await readdir(workspace)).sort()).toEqual([
				'api',
				'frontend',
				'package.json',
				'pnpm-lock.yaml',
				'pnpm-workspace.yaml'
			]);
			expect(await readdir(join(workspace, 'api'))).toEqual(['package.json']);
			expect(await readdir(join(workspace, 'frontend'))).toEqual(['package.json']);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
	it('selects frontend production dependencies and rejects unknown packages', () => {
		const deployed = join(tmpdir(), 'benchcore-frontend-fixture');
		expect(deploymentArguments('frontend', deployed)[1]).toBe('benchcore-frontend');
		expect(() => deploymentArguments('unknown', deployed)).toThrow();
	});
});
