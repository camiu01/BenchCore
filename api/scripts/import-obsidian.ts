/**
 * @file import-obsidian.ts
 * @brief Imports a local Obsidian vault with explicit visibility and no source writes.
 */
import { resolve } from 'node:path';
import { getDb } from '../src/db/client.js';
import { createDrizzleRepos } from '../src/db/drizzle.js';
import { readObsidianDirectory } from '../src/posts/obsidian-directory.js';
import { importObsidianVault } from '../src/posts/obsidian-import.js';

const [directory, visibility = 'private', ...extra] = process.argv.slice(2);
if (!directory || !['private', 'public', 'readers'].includes(visibility) || extra.length > 0) {
	process.stderr.write('Usage: pnpm obsidian:import <vault-directory> [private|public|readers]\n');
	process.exit(1);
}
try {
	const files = await readObsidianDirectory(resolve(directory));
	const result = await importObsidianVault({ files, visibility }, createDrizzleRepos(getDb()));
	process.stdout.write(`${JSON.stringify(result, null, '\t')}\n`);
	process.exit(result.errors.length > 0 ? 1 : 0);
} catch (error) {
	process.stderr.write(`${error instanceof Error ? error.message : 'vault import failed'}\n`);
	process.exit(1);
}
