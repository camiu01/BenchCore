/**
 * @file import.ts
 * @brief content:import CLI. Imports Markdown+TOML files, upserts by slug.
 */
import { fileURLToPath } from 'node:url';
import { getDb } from '../src/db/client.js';
import { createDrizzleRepos } from '../src/db/drizzle.js';
import { importDirectory } from '../src/posts/import-service.js';

const defaultDir = fileURLToPath(new URL('../../content/posts', import.meta.url));
const dir = process.env['CONTENT_DIR'] ?? defaultDir;

const repos = createDrizzleRepos(getDb());
const result = await importDirectory(dir, repos);

for (const slug of result.created) {
	process.stdout.write(`created ${slug}\n`);
}
for (const slug of result.updated) {
	process.stdout.write(`updated ${slug}\n`);
}
for (const failure of result.errors) {
	process.stderr.write(`error ${failure.file}: ${failure.message}\n`);
}
process.exit(result.errors.length > 0 ? 1 : 0);
