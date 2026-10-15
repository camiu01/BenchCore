/**
 * @file obsidian-import.test.ts
 * @brief Vault conversion, access modes, collisions and read-only folder import regressions.
 */
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importObsidianVault } from '../src/posts/obsidian-import.js';
import { readObsidianDirectory } from '../src/posts/obsidian-directory.js';
import { vaultSlug } from '../src/posts/obsidian-source.js';
import { getPublishedPost, listPublishedPosts } from '../src/posts/post-service.js';
import { createTestRepos } from './helpers.js';

describe('Obsidian vault import', () => {
	it('imports plain notes recursively and resolves forward, accented and section wikilinks', async () => {
		const repos = createTestRepos();
		const result = await importObsidianVault({ files: [
			{ path: 'Theory/Index.md', source: '[[Caffè|Coffee]] [[Glossary#npn|NPN]] [[missing]]' },
			{ path: 'Theory/Caffè.md', source: 'Coffee body' },
			{ path: 'Glossary.md', source: '## npn\nDefinition' }
		] }, repos);
		expect(result.errors).toEqual([]);
		expect(result.created).toHaveLength(3);
		const index = await repos.posts.findBySlug('theory-index');
		expect(index?.contentMarkdown).toBe('[[theory-caffe|Coffee]] [[glossary#npn|NPN]] missing');
		expect(index?.contentHtml).toContain('/posts/theory-caffe');
		expect(result.warnings).toHaveLength(1);
	});

	it('defaults to private and ignores source publication fields', async () => {
		const repos = createTestRepos();
		const result = await importObsidianVault({ files: [{
			path: 'Secret.md',
			source: '---\ntitle: Private title\ntags: [bench, tools]\nstatus: published\npublish_at: 2020-01-01\n---\nSecret body'
		}] }, repos);
		expect(result.errors).toEqual([]);
		expect((await repos.posts.findBySlug('secret'))?.status).toBe('draft');
		expect((await repos.posts.findBySlug('secret'))?.publishAt).toBeNull();
		expect(await getPublishedPost(repos, 'secret')).toBeNull();
		expect((await listPublishedPosts(repos, {})).items).toEqual([]);
		expect(await getPublishedPost({ ...repos, viewerRole: 'reader' }, 'secret')).toBeNull();
		expect(await repos.tags.getPostTagNames((await repos.posts.findBySlug('secret'))!.id)).toEqual(['bench', 'tools']);
	});

	it.each(['public', 'readers'] as const)('applies explicit %s access', async (visibility) => {
		const repos = createTestRepos();
		const result = await importObsidianVault({ visibility, files: [{ path: 'Note.md', source: 'Protected body' }] }, repos);
		expect(result.errors).toEqual([]);
		expect((await repos.posts.findBySlug('note'))?.status).toBe('published');
		expect((await repos.posts.findBySlug('note'))?.audience).toBe(visibility);
		const guest = await getPublishedPost(repos, 'note');
		expect(guest?.contentHtml.includes('Protected body')).toBe(visibility === 'public');
		expect((await getPublishedPost({ ...repos, viewerRole: 'reader' }, 'note'))?.contentHtml).toContain('Protected body');
	});

	it('never overwrites existing posts, including on visibility changes', async () => {
		const repos = createTestRepos();
		await importObsidianVault({ files: [{ path: 'Note.md', source: 'Original' }] }, repos);
		const repeat = await importObsidianVault({ visibility: 'public', files: [{ path: 'Note.md', source: 'Changed' }] }, repos);
		expect(repeat.errors).toHaveLength(1);
		expect((await repos.posts.findBySlug('note'))?.contentMarkdown).toBe('Original');
		expect((await repos.posts.findBySlug('note'))?.status).toBe('draft');
	});

	it('isolates malformed YAML and rejects all colliding slugs', async () => {
		const result = await importObsidianVault({ files: [
			{ path: 'Bad.md', source: '---\ntitle: [bad\n---\nBody' },
			{ path: 'Hello world.md', source: 'First' },
			{ path: 'Hello-world.md', source: 'Second' },
			{ path: 'Good.md', source: 'Safe<script>alert(1)</script>' }
		] }, createTestRepos());
		expect(result.created).toEqual(['good']);
		expect(result.errors).toHaveLength(3);
	});

	it('leaves ambiguous references readable and does not convert code or upload embeds', async () => {
		const repos = createTestRepos();
		const result = await importObsidianVault({ files: [
			{ path: 'Index.md', source: '[[Note]] [[A/Note|A]] ![[image.png]] `[[A/Note]]`\n```\n[[A/Note]]\n```' },
			{ path: 'A/Note.md', source: 'A' }, { path: 'B/Note.md', source: 'B' },
			{ path: '.obsidian/ignore.md', source: 'Private settings' }
		] }, repos);
		expect(result.errors).toEqual([]);
		expect(result.skipped).toEqual(['.obsidian/ignore.md']);
		expect((await repos.posts.findBySlug('index'))?.contentMarkdown)
			.toBe('Note [[a-note|A]] image.png `[[A/Note]]`\n```\n[[A/Note]]\n```');
	});

	it.each(['../secret.md', '/secret.md', 'C:/secret.md', 'folder\\secret.md'])(
		'rejects unsafe path %s before any writes', async (path) => {
			const repos = createTestRepos();
			await expect(importObsidianVault({ files: [{ path, source: 'Secret' }] }, repos)).rejects.toThrow();
			expect((await repos.posts.listAdmin({ limit: 25, offset: 0 })).total).toBe(0);
		}
	);

	it('rejects oversized sources and handles long and non-Latin names deterministically', async () => {
		await expect(importObsidianVault({ files: [{ path: 'Big.md', source: 'x'.repeat(200_001) }] },
			createTestRepos())).rejects.toThrow();
		expect(vaultSlug(`${'x'.repeat(200)}.md`)).toHaveLength(99);
		expect(vaultSlug('日本語.md')).toMatch(/^note-[a-f0-9]{12}$/);
	});

	it('reads nested local files without changing sources or importing settings', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'benchcore-vault-'));
		try {
			await mkdir(join(directory, 'Notes'));
			await mkdir(join(directory, '.obsidian'));
			await writeFile(join(directory, 'Notes', 'Note.md'), 'Original source');
			await writeFile(join(directory, '.obsidian', 'ignored.md'), 'Settings');
			await writeFile(join(directory, 'attachment.png'), 'Image');
			const files = await readObsidianDirectory(directory);
			expect(files).toEqual([{ path: 'Notes/Note.md', source: 'Original source' }]);
			expect(await readFile(join(directory, 'Notes', 'Note.md'), 'utf8')).toBe('Original source');
		} finally { await rm(directory, { recursive: true, force: true }); }
	});
});
