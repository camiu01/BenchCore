/**
 * @file playwright.config.ts
 * @brief Production-browser checks against an owned, credential-free fixture.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	workers: 1,
	timeout: 60_000,
	use: {
		baseURL: 'http://127.0.0.1:5198',
		browserName: 'chromium',
		trace: 'retain-on-failure',
		contextOptions: { reducedMotion: 'reduce' }
	},
	reporter: process.env['CI'] ? 'github' : 'list',
	webServer: {
		command: 'node ../scripts/browser-fixture.mjs',
		url: 'http://127.0.0.1:5198/health/live',
		reuseExistingServer: false,
		timeout: 30_000
	}
});
