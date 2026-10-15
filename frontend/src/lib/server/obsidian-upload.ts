/**
 * @file obsidian-upload.ts
 * @brief Validates one vault ZIP or a bounded selection of Markdown uploads.
 */
import { readVaultZip, type VaultSources } from './obsidian-zip.js';

/**
 * @brief Validates Markdown filenames and batch limits before reading file bodies.
 * @param files Selected browser files.
 * @return Nothing, or a validation error.
 */
function validateNotes(files: File[]): void {
	let total = 0;
	const names = new Set<string>();
	for (const file of files) {
		const name = file.name;
		const key = name.normalize('NFC').toLowerCase();
		if (
			!/\.md$/i.test(name) ||
			name.startsWith('.') ||
			/[/\\:]/.test(name) ||
			name.length > 1000 ||
			names.has(key)
		) {
			throw new Error('select Markdown files with unique filenames');
		}
		total += file.size;
		if (file.size > 200_000 || total > 2_000_000) {
			throw new Error('selection exceeds Markdown size limits');
		}
		names.add(key);
	}
}

/**
 * @brief Reads either a single ZIP or multiple UTF-8 Markdown notes, never mixed.
 * @param entries Multipart values for the file input.
 * @return Validated note sources and skipped archive entries.
 */
export async function readVaultUploads(entries: FormDataEntryValue[]): Promise<VaultSources> {
	if (entries.length === 0 || entries.length > 500) {
		throw new Error('select one ZIP or up to 500 Markdown files');
	}
	const files: File[] = [];
	for (const entry of entries) {
		if (!(entry instanceof File) || entry.name === '') {
			throw new Error('invalid file selection');
		}
		files.push(entry);
	}
	const archive = files[0];
	if (files.length === 1 && archive && /\.zip$/i.test(archive.name)) {
		if (archive.size > 2_000_000) {
			throw new Error('ZIP exceeds 2 MB');
		}
		return readVaultZip(new Uint8Array(await archive.arrayBuffer()));
	}
	validateNotes(files);
	const result: VaultSources = { files: [], skipped: [] };
	for (const file of files) {
		const source = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
		result.files.push({ path: file.name, source });
	}
	return result;
}
