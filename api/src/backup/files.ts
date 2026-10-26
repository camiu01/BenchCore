/**
 * @file files.ts
 * @brief Bounded archive reads, plain-file guards and streaming integrity checks.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, open, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { manifestSchema, type BackupManifest } from './manifest.js';

/** @brief Rejects symbolic links and non-directories at archive boundaries. @param directory Directory to inspect. @return Completion. */
export async function plainDirectory(directory: string): Promise<void> {
	const info = await lstat(directory);
	if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe backup directory');
}

/** @brief Allows only ordinary, singly linked files within an explicit byte limit. @param file File to inspect. @param maximum Maximum bytes. @return File byte length. */
export async function plainFile(file: string, maximum = Number.MAX_SAFE_INTEGER): Promise<number> {
	const info = await lstat(file);
	if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > maximum) {
		throw new Error('Unsafe or oversized backup file');
	}
	return info.size;
}

/** @brief Hashes large dumps without retaining their contents in memory. @param file File to hash. @return SHA-256 and byte length. */
export async function fingerprint(file: string): Promise<{ sha256: string; sizeBytes: number }> {
	const sizeBytes = await plainFile(file);
	const hash = createHash('sha256');
	for await (const chunk of createReadStream(file)) hash.update(chunk);
	return { sha256: hash.digest('hex'), sizeBytes };
}

/** @brief Rejects non-custom PostgreSQL dump headers before running a native restore. @param file Verified ordinary file. @return Completion. */
export async function customDump(file: string): Promise<void> {
	const handle = await open(file, 'r');
	try {
		const header = Buffer.alloc(5);
		await handle.read(header, 0, 5, 0);
		if (header.toString('ascii') !== 'PGDMP') throw new Error('Not a custom PostgreSQL dump');
	} finally {
		await handle.close();
	}
}

/** @brief Reads a bounded manifest and rejects unknown archive entries before target writes. @param directory Private backup directory. @return Validated manifest. */
export async function readManifest(directory: string): Promise<BackupManifest> {
	await plainDirectory(directory);
	const entries = (await readdir(directory)).sort();
	if (JSON.stringify(entries) !== JSON.stringify(['database.dump', 'manifest.json', 'media'])) {
		throw new Error('Incomplete or unexpected backup entries');
	}
	const file = join(directory, 'manifest.json');
	await plainFile(file, 64 * 1024 * 1024);
	const manifest = manifestSchema.parse(JSON.parse(await readFile(file, 'utf8')));
	await plainDirectory(join(directory, 'media'));
	const keys = (await readdir(join(directory, 'media'))).sort();
	if (JSON.stringify(keys) !== JSON.stringify(manifest.media.map((item) => item.key).sort())) {
		throw new Error('Media inventory does not match the manifest');
	}
	return manifest;
}
