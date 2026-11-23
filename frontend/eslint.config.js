import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	...tseslint.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser
			}
		}
	},
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		},
		rules: {
			'no-console': ['warn', { allow: ['warn', 'error'] }],
			// Added to the recommended set in eslint-plugin-svelte 3.x. BenchCore is served
			// from the domain root (no paths.base), so root-relative links are already
			// correct. Re-enable and route links through resolve() if a base path is adopted.
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		ignores: [
			'.svelte-kit/',
			'.vercel/',
			'build/',
			'.pnpm-store/',
			'test-results/',
			'playwright-report/'
		]
	}
];
