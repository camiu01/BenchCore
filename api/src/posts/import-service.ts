/**
 * @file import-service.ts
 * @brief Imports Markdown+TOML files into posts. Upserts by slug, never duplicates.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseTomlBlock, splitFrontmatter } from '../markdown/frontmatter.js';
import { validateFrontmatter } from '../markdown/schema.js';
import { createPost, updatePost, type PostServiceDeps } from './post-service.js';

/**
 * @brief Per-file import failure.
 */
export interface ImportFileError {
	file: string;
	message: string;
}

/**
 * @brief Aggregate result of one import run.
 */
export interface ImportResult {
	created: string[];
	updated: string[];
	errors: ImportFileError[];
}

/**
 * @brief Imports every .md file in a directory into the post store.
 * @param dir The content directory.
 * @param deps The post service repositories.
 * @param authorId The author id stamped on created posts, if any.
 * @return The created/updated slugs plus per-file errors.
 */
export async function importDirectory(
	dir: string,
	deps: PostServiceDeps,
	authorId?: string
): Promise<ImportResult> {
	const result: ImportResult = { created: [], updated: [], errors: [] };
	let entries: string[];
	try {
		entries = (await readdir(dir)).filter((entry) => entry.endsWith('.md')).sort();
	} catch {
		return { created: [], updated: [], errors: [{ file: dir, message: 'cannot read directory' }] };
	}
	const knownSlugs = new Set<string>();
	for (const file of entries) {
		try {
			const source = await readFile(join(dir, file), 'utf8');
			const split = splitFrontmatter(source, file);
			if (!split.ok) {
				result.errors.push({ file, message: split.issue.message });
				continue;
			}
			const toml = parseTomlBlock(split.toml, file);
			if (!toml.ok) {
				result.errors.push({ file, message: toml.issue.message });
				continue;
			}
			const frontmatter = validateFrontmatter(toml.data);
			if (!frontmatter.ok) {
				result.errors.push({ file, message: frontmatter.issues.join('; ') });
				continue;
			}
			const value = frontmatter.value;
			const existing = await deps.posts.findBySlug(value.slug);
			const payload = {
				title: value.title,
				slug: value.slug,
				description: value.description,
				status: value.status,
				tags: value.tags,
				publishedAt: value.published_at,
				contentMarkdown: split.body,
				coverImage: value.cover_image
			};
			if (existing === null) {
				await createPost(deps, payload, authorId, knownSlugs);
				result.created.push(value.slug);
			} else {
				await updatePost(deps, existing.id, payload);
				result.updated.push(value.slug);
			}
			knownSlugs.add(value.slug);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'unknown import failure';
			result.errors.push({ file, message });
		}
	}
	return result;
}
