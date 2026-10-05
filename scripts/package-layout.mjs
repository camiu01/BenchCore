/**
 * @file package-layout.mjs
 * @brief Keeps legacy pnpm deployment paths within isolated writable staging.
 */
import { cp, mkdir, mkdtemp } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * @brief Creates unique staging under the artifact directory instead of OS temp.
 * @param {string} artifacts Absolute writable artifact directory.
 * @return {Promise<string>} Staging directory.
 */
export async function createPackageStaging(artifacts) {
	await mkdir(artifacts, { recursive: true });
	return mkdtemp(join(artifacts, '.benchcore-beta-'));
}

/**
 * @brief Reserves Windows final paths before creating nonrelocatable junctions.
 * @param {string} temporary Owned staging directory.
 * @param {string} destination Final versioned artifact.
 * @param {string} [platform] Target filesystem platform.
 * @return {Promise<string>} Newly created bundle directory.
 */
export async function createBundleDirectory(temporary, destination, platform = process.platform) {
	const bundle = platform === 'win32' ? destination : join(temporary, 'bundle');
	await mkdir(bundle);
	return bundle;
}

/**
 * @brief Copies only dependency metadata into an isolated temporary workspace.
 * @param {string} root Source checkout.
 * @param {string} temporary Owned staging directory.
 * @return {Promise<string>} Dependency workspace.
 */
export async function createDependencyWorkspace(root, temporary) {
	const workspace = join(temporary, 'workspace');
	for (const name of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
		'api/package.json', 'frontend/package.json']) {
		const destination = join(workspace, name);
		await mkdir(dirname(destination), { recursive: true });
		await cp(join(root, name), destination);
	}
	return workspace;
}

/**
 * @brief Selects production dependencies for a known application package.
 * @param {string} name API or frontend package directory.
 * @param {string} deployed Absolute dependency deployment directory.
 * @return {string[]} Arguments for the pinned pnpm deployment command.
 */
export function deploymentArguments(name, deployed) {
	if (!['api', 'frontend'].includes(name)) { throw new Error('Unknown deployment package'); }
	return ['--filter', `benchcore-${name}`, 'deploy', '--legacy', '--prod', deployed];
}
