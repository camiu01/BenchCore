/**
 * @file check-release.mjs
 * @brief Credential-free local/CI release metadata validation, without tagging or publishing.
 */
import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readReleaseVersion } from './release-version.mjs';

/** @brief Reports validated release controls and optional CI outputs. @return {Promise<void>} Completion. */
async function main() {
	const root = fileURLToPath(new URL('..', import.meta.url));
	const release = await readReleaseVersion(root, process.env['RELEASE_REF'] ?? '');
	if (process.env['GITHUB_OUTPUT']) {
		await appendFile(process.env['GITHUB_OUTPUT'], Object.entries(release).map(([key, value]) => `${key}=${value}\n`).join(''));
	}
	process.stdout.write(`Release ${release.version}: ${release.prerelease ? 'prerelease' : 'stable'}, approval environment ${release.environment}\n`);
}
main().catch(() => { process.stderr.write('Release validation failed: check workspace versions and the exact release tag.\n'); process.exitCode = 1; });
