/**
 * @file obsidian-import.ts
 * @brief Safe create-only vault imports with explicit publication visibility.
 */
import { posix } from 'node:path';
import { createPost, type PostServiceDeps } from './post-service.js';
import { isVaultNote, parseVaultNote, vaultImportSchema, type VaultNote } from './obsidian-source.js';

export interface VaultImportResult {
	created: string[];
	skipped: string[];
	errors: { file: string; message: string }[];
	warnings: { file: string; message: string }[];
}

/**
 * @brief Resolves Obsidian paths, local relative paths and unique short names.
 * @param target Original note target without fragment.
 * @param note Source note.
 * @param notes Vault index.
 * @return Unique target or undefined for missing or ambiguous references.
 */
function resolveNote(target: string, note: VaultNote, notes: VaultNote[]): VaultNote | undefined {
	if (target === '') { return note; }
	const key = target.replace(/\.md$/i, '').normalize('NFC').toLowerCase();
	const relative = posix.join(posix.dirname(note.path), key);
	const exact = notes.filter((entry) => {
		const path = entry.path.replace(/\.md$/i, '').normalize('NFC').toLowerCase();
		return path === key || path === relative;
	});
	if (exact.length === 1) { return exact[0]; }
	const short = notes.filter((entry) =>
		posix.basename(entry.path).replace(/\.md$/i, '').normalize('NFC').toLowerCase() === key);
	return short.length === 1 ? short[0] : undefined;
}

/**
 * @brief Converts links outside code, leaving unsupported references readable.
 * @param note Source note.
 * @param notes Complete note index.
 * @param result Warning collector.
 * @return BenchCore Markdown.
 */
function convertLinks(note: VaultNote, notes: VaultNote[], result: VaultImportResult): string {
	const segments = note.body.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g);
	return segments.map((segment, index) => {
		if (index % 2 !== 0) { return segment; }
		return segment.replace(/(!?)\[\[([^\]\n]+)\]\]/g, (_whole, embed: string, raw: string) => {
			const [reference = '', alias] = raw.split('|');
			const [target = '', fragment] = reference.split('#');
			const destination = resolveNote(target, note, notes);
			const label = (alias ?? (target || fragment) ?? reference).replace(/[\[\]\r\n]/g, '');
			if (!destination || embed) {
				result.warnings.push({ file: note.path, message: `unsupported or unresolved reference: ${reference}` });
				return label;
			}
			return `[[${destination.slug}${fragment ? `#${fragment}` : ''}|${label}]]`;
		});
	}).join('');
}

/**
 * @brief Imports a validated vault without changing existing posts or source files.
 * @param input Untrusted files and selected visibility.
 * @param deps Repository dependencies.
 * @param authorId Optional authenticated author.
 * @return Created notes, skipped settings and independent failures.
 */
export async function importObsidianVault(input: unknown, deps: PostServiceDeps,
	authorId?: string): Promise<VaultImportResult> {
	const value = vaultImportSchema.parse(input);
	const result: VaultImportResult = { created: [], skipped: [], errors: [], warnings: [] };
	const notes: VaultNote[] = [];
	for (const file of value.files) {
		if (!isVaultNote(file.path)) { result.skipped.push(file.path); continue; }
		try { notes.push(parseVaultNote(file)); }
		catch (error) { result.errors.push({ file: file.path, message: error instanceof Error ? error.message : 'invalid note' }); }
	}
	const counts = new Map<string, number>();
	for (const note of notes) { counts.set(note.slug, (counts.get(note.slug) ?? 0) + 1); }
	const known = new Set(notes.map((note) => note.slug));
	for (const note of notes) {
		try {
			if (counts.get(note.slug) !== 1) { throw new Error('duplicate normalized path or slug'); }
			await createPost(deps, {
				title: note.title, slug: note.slug, description: note.description, tags: note.tags,
				contentMarkdown: convertLinks(note, notes, result),
				status: value.visibility === 'private' ? 'draft' : 'published',
				audience: value.visibility === 'readers' ? 'readers' : 'public'
			}, authorId, known);
			result.created.push(note.slug);
		} catch (error) {
			result.errors.push({ file: note.path, message: error instanceof Error ? error.message : 'import failed' });
		}
	}
	return result;
}
