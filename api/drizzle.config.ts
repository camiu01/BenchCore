/**
 * @file drizzle.config.ts
 * @brief drizzle-kit configuration. `generate` is offline-safe (no live DB needed).
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	strict: true,
	verbose: true
});
