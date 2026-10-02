/**
 * @file vite.config.ts
 * @brief Frontend build, test and nonce-backed content security policy configuration.
 */
import adapter from '@sveltejs/adapter-node';
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
for (const key of ['SITE_URL', 'PUBLIC_SITE_URL', 'PUBLIC_API_URL']) {
	if (process.env[key] === undefined && rootEnv[key] !== undefined) {
		process.env[key] = rootEnv[key];
	}
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter(),
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
					'connect-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['none'],
					'frame-ancestors': ['none'],
					'form-action': ['self']
				}
			}
		})
	],
	test: {
		include: ['tests/**/*.test.ts', 'src/**/*.test.ts']
	}
});
