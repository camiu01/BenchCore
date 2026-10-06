/**
 * @file release-version.test.ts
 * @brief Shared stable/beta semver, workspace consistency and exact publication gates.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readReleaseVersion, releaseVersion } from '../../scripts/release-version.mjs';

describe('release metadata', () => {
	it('supports stable delivery without treating it as a prerelease', () => {
		expect(releaseVersion('0.7.0', 'refs/tags/v0.7.0')).toEqual({
			version: '0.7.0',
			prerelease: false,
			environment: 'stable-release'
		});
		expect(releaseVersion('0.7.0-beta.1', 'refs/tags/v0.7.0-beta.1').environment).toBe(
			'beta-release'
		);
		for (const version of [
			'0.7',
			'v0.7.0',
			'01.7.0',
			'0.7.0-beta.01',
			'0.7.0-rc.1',
			'0.7.0\nbad'
		]) {
			expect(() => releaseVersion(version)).toThrow();
		}
		expect(() => releaseVersion('0.7.0', 'refs/tags/v0.6.0')).toThrow();
	});

	it('keeps every workspace version aligned and release publication behind a tag and approval environment', async () => {
		expect(
			(await readReleaseVersion(fileURLToPath(new URL('../../', import.meta.url)))).version
		).toBe('0.7.0');
		const workflow = await readFile(
			new URL('../../.github/workflows/cd.yml', import.meta.url),
			'utf8'
		);
		expect(workflow).toContain("if: startsWith(github.ref, 'refs/tags/')");
		expect(workflow).toContain('environment: ${{ needs.bundle.outputs.environment }}');
		expect(workflow).toContain('sha256sum --check SHA256SUMS');
		expect(workflow).toContain('gh release create "$RELEASE_TAG" --verify-tag');
	});
});
