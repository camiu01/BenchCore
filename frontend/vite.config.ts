/**
 * @file vite.config.ts
 * @brief Frontend build, test and nonce-backed content security policy configuration.
 */
import adapter from '@sveltejs/adapter-node';
import vercelAdapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

const rootEnv = loadEnv(
	process.env['NODE_ENV'] ?? 'development',
	fileURLToPath(new URL('..', import.meta.url)),
	''
);
for (const key of ['SITE_URL', 'PUBLIC_SITE_URL', 'PUBLIC_API_URL', 'R2_ACCOUNT_ID']) {
	if (process.env[key] === undefined && rootEnv[key] !== undefined) {
		process.env[key] = rootEnv[key];
	}
}
const serverless = process.env['DEPLOYMENT_TARGET'] === 'vercel' || process.env['VERCEL'] === '1';
const r2Account = process.env['R2_ACCOUNT_ID'];
if (r2Account !== undefined && !/^[a-f0-9]{32}$/.test(r2Account)) {
	throw new Error('R2_ACCOUNT_ID must be a 32-character hexadecimal account identifier');
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: serverless ? vercelAdapter({ runtime: 'nodejs24.x', maxDuration: 60 }) : adapter(),
			preprocess: vitePreprocess(),
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'script-src-attr': ['none'],
					'style-src': ['self'],
					'style-src-attr': ['none'],
					'img-src': ['self', 'https:', 'http:'],
					'connect-src': [
						'self',
						...(r2Account ? [`https://${r2Account}.r2.cloudflarestorage.com` as const] : [])
					],
					'object-src': ['none'],
					'base-uri': ['none'],
					'frame-ancestors': ['none'],
					'form-action': ['self']
				}
			}
		})
	],
	ssr: { noExternal: serverless ? true : ['cookie'] },
	test: {
		include: ['tests/**/*.test.ts', 'src/**/*.test.ts']
	}
});
