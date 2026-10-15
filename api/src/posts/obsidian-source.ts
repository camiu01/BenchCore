/**
 * @file obsidian-source.ts
 * @brief Bounded Obsidian note validation, metadata and stable vault slugs.
 */
import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { parseDocument } from 'yaml';
import { z } from 'zod';

export const vaultFileSchema = z.object({
	path: z.string().min(1).max(1000).refine((path) =>
		!path.includes('\\') && !path.startsWith('/') && !path.includes(':') &&
		path.split('/').every((part) => part !== '' && part !== '.' && part !== '..'),
	'invalid vault-relative path'),
	source: z.string().max(200_000)
}).strict();
export const vaultImportSchema = z.object({
	visibility: z.enum(['private', 'public', 'readers']).default('private'),
	files: z.array(vaultFileSchema).min(1).max(500)
}).strict().refine((value) =>
	value.files.reduce((sum, file) => sum + Buffer.byteLength(file.source), 0) <= 2_000_000,
'vault Markdown exceeds 2 MB');

export type VaultFile = z.infer<typeof vaultFileSchema>;
export interface VaultNote {
	path: string;
	slug: string;
	title: string;
	description: string;
	tags: string[];
	body: string;
}

const metadataSchema = z.object({
	title: z.string().min(1).max(200).optional(),
	description: z.string().max(500).default(''),
	tags: z.union([z.array(z.string()), z.string()]).default([])
});

/**
 * @brief Identifies Markdown sources while excluding vault settings and trash.
 * @param path Vault-relative source path.
 * @return Whether this is an importable note.
 */
export function isVaultNote(path: string): boolean {
	return /\.md$/i.test(path) && !path.split('/').some((part) => part.startsWith('.'));
}

/**
 * @brief Produces a stable path-based slug, retaining uniqueness for long or non-Latin names.
 * @param path Vault-relative source path.
 * @return Schema-compatible slug.
 */
export function vaultSlug(path: string): string {
	const stem = path.replace(/\.md$/i, '');
	const slug = stem.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
		.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	if (slug !== '' && slug.length <= 100) { return slug; }
	const hash = createHash('sha256').update(path).digest('hex').slice(0, 12);
	return `${slug.slice(0, 86).replace(/-$/, '') || 'note'}-${hash}`;
}

/**
 * @brief Parses optional YAML properties without accepting publication overrides.
 * @param file Validated Markdown source.
 * @return Note metadata and body.
 */
export function parseVaultNote(file: VaultFile): VaultNote {
	const source = file.source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
	let body = source;
	let metadata: unknown = {};
	if (source.startsWith('---\n')) {
		const end = /^---[ \t]*$/gm;
		end.lastIndex = 4;
		const match = end.exec(source);
		if (!match) { throw new Error('unclosed YAML frontmatter'); }
		const document = parseDocument(source.slice(4, match.index), { uniqueKeys: true });
		if (document.errors.length > 0) { throw new Error('invalid YAML frontmatter'); }
		metadata = document.toJS({ maxAliasCount: 20 }) ?? {};
		body = source.slice(match.index + match[0].length).replace(/^\n/, '');
	}
	const value = metadataSchema.parse(metadata);
	const rawTags = typeof value.tags === 'string' ? value.tags.split(/[,\s]+/) : value.tags;
	const tags = [...new Set(rawTags.map((tag) => tag.replace(/^#/, '').trim()).filter(Boolean))];
	return {
		path: file.path, slug: vaultSlug(file.path),
		title: value.title ?? posix.basename(file.path).replace(/\.md$/i, ''),
		description: value.description, tags, body
	};
}
