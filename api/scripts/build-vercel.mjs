/**
 * @file build-vercel.mjs
 * @brief Bundles only the Fetch entrypoint as a self-contained ESM Vercel artifact.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
await build({
	absWorkingDir: root,
	entryPoints: ['src/vercel.ts'],
	outfile: 'output/index.mjs',
	bundle: true,
	platform: 'node',
	target: 'node24',
	format: 'esm',
	banner: {
		js: 'import { createRequire as __benchcoreRequire } from \'node:module\'; const require = __benchcoreRequire(import.meta.url);'
	}
});
