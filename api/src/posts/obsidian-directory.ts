/**
 * @file obsidian-directory.ts
 * @brief Read-only bounded vault discovery without following symbolic links.
 */
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isVaultNote, type VaultFile } from './obsidian-source.js';

/**
 * @brief Reads Markdown recursively while ignoring hidden vault internals.
 * @param directory Vault directory.
 * @return Bounded note sources.
 */
export async function readObsidianDirectory(directory: string): Promise<VaultFile[]> {
	if (!(await lstat(directory)).isDirectory()) { throw new Error('vault must be a directory, not a symlink'); }
	const files: VaultFile[] = [];
	const pending = [{ absolute: directory, relative: '' }];
	let bytes = 0;
	let visited = 0;
	while (pending.length > 0) {
		const current = pending.pop()!;
		const entries = await readdir(current.absolute, { withFileTypes: true });
		for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
			if (++visited > 10_000) { throw new Error('vault exceeds 10000 directory entries'); }
			if (entry.name.startsWith('.') || entry.isSymbolicLink()) { continue; }
			const path = current.relative ? `${current.relative}/${entry.name}` : entry.name;
			const absolute = join(current.absolute, entry.name);
			if (entry.isDirectory()) { pending.push({ absolute, relative: path }); continue; }
			if (!entry.isFile() || !isVaultNote(path)) { continue; }
			const stat = await lstat(absolute);
			bytes += stat.size;
			if (stat.size > 200_000 || bytes > 2_000_000 || files.length >= 500) {
				throw new Error('vault limit: 500 notes, 200 KB per note, 2 MB Markdown total');
			}
			files.push({ path, source: await readFile(absolute, 'utf8') });
		}
	}
	return files.sort((a, b) => a.path.localeCompare(b.path));
}
