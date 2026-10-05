/**
 * @file import-service.ts
 * @brief Two-pass Markdown import with order-independent wikilink validation and slug upserts.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseTomlBlock, splitFrontmatter } from '../markdown/frontmatter.js';
import { validateFrontmatter, type Frontmatter } from '../markdown/schema.js';
import { createPost, updatePost, type PostServiceDeps } from './post-service.js';

export interface ImportFileError {
	file: string;
	message: string;
}

export interface ImportResult {
	created: string[];
	updated: string[];
	errors: ImportFileError[];
}

interface ImportEntry {
	file: string;
	value: Frontmatter;
	body: string;
}

/**
 * @brief Parses one source file before writes start.
 * @param dir Content directory.
 * @param file Relative source filename.
 * @return Validated entry.
 */
async function parseEntry(dir: string, file: string): Promise<ImportEntry> {
	const source = await readFile(join(dir, file), 'utf8');
	const split = splitFrontmatter(source, file);
	if (!split.ok) { throw new Error(split.issue.message); }
	const toml = parseTomlBlock(split.toml, file);
	if (!toml.ok) { throw new Error(toml.issue.message); }
	const frontmatter = validateFrontmatter(toml.data);
	if (!frontmatter.ok) { throw new Error(frontmatter.issues.join('; ')); }
	return { file, value: frontmatter.value, body: split.body };
}

/**
 * @brief Upserts a validated source without duplicating publication rules.
 * @param entry Validated source.
 * @param deps Repositories.
 * @param knownSlugs Complete source slug set.
 * @param authorId Optional author.
 * @return Whether the row was created or updated.
 */
async function importEntry(entry: ImportEntry, deps: PostServiceDeps,
	knownSlugs: Set<string>, authorId?: string): Promise<'created' | 'updated'> {
	const { value, body } = entry;
	const existing = await deps.posts.findBySlug(value.slug);
	const payload = {
		title: value.title, slug: value.slug, description: value.description, status: value.status,
		audience: value.audience,
		tags: value.tags, publishedAt: value.published_at, publishAt: value.publish_at ?? null,
		contentMarkdown: body, coverImage: value.cover_image ?? null
	};
	if (existing === null) {
		await createPost(deps, payload, authorId, knownSlugs);
		return 'created';
	}
	await updatePost(deps, existing.id, payload);
	return 'updated';
}

/**
 * @brief Imports all Markdown sources with independent errors per file.
 * @param dir Content directory.
 * @param deps Repositories.
 * @param authorId Optional author for new rows.
 * @return Created and updated slugs plus file failures.
 */
export async function importDirectory(dir: string, deps: PostServiceDeps,
	authorId?: string): Promise<ImportResult> {
	const result: ImportResult = { created: [], updated: [], errors: [] };
	let files: string[];
	try { files = (await readdir(dir)).filter((file) => file.endsWith('.md')).sort(); }
	catch { return { ...result, errors: [{ file: dir, message: 'cannot read directory' }] }; }
	const entries: ImportEntry[] = [];
	for (const file of files) {
		try { entries.push(await parseEntry(dir, file)); }
		catch (error) { result.errors.push({ file, message: error instanceof Error ? error.message : 'invalid source' }); }
	}
	const knownSlugs = new Set(entries.map((entry) => entry.value.slug));
	for (const entry of entries) {
		try {
			const kind = await importEntry(entry, deps, knownSlugs, authorId);
			result[kind].push(entry.value.slug);
		} catch (error) {
			result.errors.push({ file: entry.file, message: error instanceof Error ? error.message : 'import failed' });
		}
	}
	return result;
}
