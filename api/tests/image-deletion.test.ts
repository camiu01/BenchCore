/**
 * @file image-deletion.test.ts
 * @brief Managed image parsing, confirmed shared deletion and concurrency regressions.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { imageUsage, deleteManagedImage } from '../src/media/deletion-service.js';
import { managedImageKeys, removeImageReferences } from '../src/media/references.js';
import { createPost } from '../src/posts/post-service.js';
import { createTestRepos, type TestRepos } from './helpers.js';

const key = `${'a'.repeat(32)}.png`;
const url = `/api/media/${key}`;
let repos: TestRepos;
beforeEach(() => { repos = createTestRepos(); });

describe('managed image references', () => {
	it('handles unquoted HTML sources without interpreting comments or other attributes as images', () => {
		const real = `<img alt="value > marker" src=${url}>`;
		const comment = `<!-- <img src="${url}"> -->`;
		const external = `<img alt='src="${url}"' src="https://example.test/photo.png">`;
		const markdown = `${real}\n\n${comment}\n\n${external}`;
		expect(managedImageKeys(markdown, '')).toEqual([key]);
		const cleaned = removeImageReferences(markdown, key);
		expect(cleaned).toContain(comment);
		expect(cleaned).toContain(external);
		expect(managedImageKeys(cleaned, '')).toEqual([]);
	});
	it('recognizes inline, reference-style and HTML images, but not code or external files', () => {
		const markdown = `![inline](${url})\n\n![reference][photo]\n\n[photo]: ${url}\n\n` +
			`<img src="${url}">\n\n\`![example](${url})\`\n\n![remote](https://example.test/${key})`;
		expect(managedImageKeys(markdown, key)).toEqual([key]);
		const cleaned = removeImageReferences(markdown, key);
		expect(managedImageKeys(cleaned, '')).toEqual([]);
		expect(cleaned).toContain(`\`![example](${url})\``);
		expect(cleaned).toContain('https://example.test/');
	});

	it('preserves code containing the same exact syntax as a removed image', () => {
		const reference = `![diagram](${url})`;
		const markdown = `\`${reference}\`\n\n${reference}`;
		expect(removeImageReferences(markdown, key)).toBe(`\`${reference}\`\n\n`);
	});
});

describe('confirmed storage deletion', () => {
	it('removes bytes, matching covers and references from all saved post statuses', async () => {
		const media = await repos.media.save(Buffer.from('image'), 'test.png', 'image/png');
		const mediaUrl = `/api/media/${media.key}`;
		const deps = { posts: repos.posts, tags: repos.tags, users: repos.users };
		const first = await createPost(deps, {
			title: 'One', slug: 'one', contentMarkdown: `Keep ![one](${mediaUrl}) text.`,
			coverImage: mediaUrl
		});
		const second = await createPost(deps, {
			title: 'Two', slug: 'two', status: 'archived',
			contentMarkdown: `![two][photo]\n\n[photo]: ${mediaUrl}`, coverImage: media.key
		});
		const usage = await imageUsage(repos.posts, media.key);
		expect(usage.rows).toHaveLength(2);
		expect(await deleteManagedImage(repos.posts, repos.media, media.key, usage.version)).toBe('deleted');
		expect(await repos.media.load(media.key)).toBeNull();
		for (const post of [first, second]) {
			const updated = await repos.posts.findById(post.id);
			expect(updated?.coverImage).toBeNull();
			expect(managedImageKeys(updated!.contentMarkdown, '')).toEqual([]);
			expect(updated?.contentHtml).not.toContain('<img');
		}
	});

	it('rejects stale confirmation without deleting storage or editing posts', async () => {
		const media = await repos.media.save(Buffer.from('image'), 'test.png', 'image/png');
		const usage = await imageUsage(repos.posts, media.key);
		await createPost({ ...repos }, {
			title: 'New use', slug: 'new-use', contentMarkdown: `![new](/api/media/${media.key})`
		});
		const remove = vi.spyOn(repos.media, 'remove');
		expect(await deleteManagedImage(repos.posts, repos.media, media.key, usage.version)).toBe('conflict');
		expect(remove).not.toHaveBeenCalled();
	});

	it('does not delete storage when optimistic post updates conflict', async () => {
		const remove = vi.spyOn(repos.media, 'remove');
		vi.spyOn(repos.posts, 'updateMediaReferences').mockResolvedValue(false);
		const usage = await imageUsage(repos.posts, key);
		expect(await deleteManagedImage(repos.posts, repos.media, key, usage.version)).toBe('conflict');
		expect(remove).not.toHaveBeenCalled();
	});

	it('reports storage failure explicitly instead of claiming deletion succeeded', async () => {
		vi.spyOn(repos.media, 'remove').mockRejectedValue(new Error('offline'));
		const usage = await imageUsage(repos.posts, key);
		expect(await deleteManagedImage(repos.posts, repos.media, key, usage.version)).toBe('storage_failed');
	});
});
