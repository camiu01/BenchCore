/**
 * @file release-version.mjs
 * @brief Shared stable/beta release validation for local packaging and CI.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** @brief Validates supported semver and exact tag matching. @param {unknown} version Manifest version. @param {string} ref CI ref. @return {{version: string, prerelease: boolean, environment: string}} Release controls. */
export function releaseVersion(version, ref = '') {
	if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/.test(version)) {
		throw new Error('Use a stable or numbered beta semver');
	}
	if (ref.startsWith('refs/tags/') && ref !== `refs/tags/v${version}`) throw new Error('Tag and manifest version do not match');
	const prerelease = version.includes('-beta.');
	return { version, prerelease, environment: prerelease ? 'beta-release' : 'stable-release' };
}

/** @brief Checks all workspace versions before producing a release artifact. @param {string} root Repository directory. @param {string} ref CI ref. @return {Promise<ReturnType<typeof releaseVersion>>} Consistent release controls. */
export async function readReleaseVersion(root, ref = '') {
	const manifests = await Promise.all(['package.json', 'api/package.json', 'frontend/package.json']
		.map(async (path) => JSON.parse(await readFile(join(root, path), 'utf8'))));
	const release = releaseVersion(manifests[0].version, ref);
	if (manifests.some((manifest) => manifest.version !== release.version)) throw new Error('Workspace versions must match');
	return release;
}
