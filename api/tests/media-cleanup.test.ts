/**
 * @file media-cleanup.test.ts
 * @brief Dry-run safety, saved-status protection, limits and concurrent-use rechecks.
 */
import { describe, expect, it, vi } from 'vitest';
import { cleanupArguments, cleanupOrphanMedia } from '../src/media/cleanup-service.js';
import { createPost } from '../src/posts/post-service.js';
import { createTestRepos } from './helpers.js';

describe('orphan media cleanup', () => {
	it('defaults to a bounded dry-run and rejects unsafe arguments', () => {
		expect(cleanupArguments([])).toEqual({ apply: false, maintenance: false, limit: 100 });
		for (const args of [['--apply'], ['--limit', '0'], ['--limit', '1001'], ['--unknown'],
			['--apply', '--maintenance', '--dry-run'], ['--limit']]) expect(() => cleanupArguments(args)).toThrow();
	});

	it('protects references in drafts, archived and reader-only posts, and never deletes in dry-run', async () => {
		const repos = createTestRepos();
		for (const status of ['draft', 'archived', 'published'] as const) {
			const media = await repos.media.save(Buffer.from('image'), `${status}.png`, 'image/png');
			await createPost(repos, { title: status, slug: status, status, audience: 'readers',
				contentMarkdown: `![](/api/media/${media.key})` });
		}
		await repos.media.save(Buffer.from('orphan'), 'orphan.png', 'image/png');
		const remove = vi.spyOn(repos.media, 'remove');
		expect(await cleanupOrphanMedia(repos.posts, repos.media)).toMatchObject({
			mode: 'dry-run', scanned: 4, orphaned: 1, deleted: 0
		});
		expect(remove).not.toHaveBeenCalled();
	});

	it('applies only the selected bounded candidates and reports storage failures', async () => {
		const repos = createTestRepos();
		for (let index = 0; index < 3; index++) await repos.media.save(Buffer.from('image'), `${index}.png`, 'image/png');
		expect(await cleanupOrphanMedia(repos.posts, repos.media, { apply: true, maintenance: true, limit: 1 }))
			.toMatchObject({ orphaned: 3, selected: 1, deleted: 1 });
		vi.spyOn(repos.media, 'remove').mockRejectedValue(new Error('offline'));
		expect(await cleanupOrphanMedia(repos.posts, repos.media, { apply: true, maintenance: true }))
			.toMatchObject({ failed: 2, deleted: 0 });
	});

	it('skips a candidate that gains a saved use after the initial scan', async () => {
		const repos = createTestRepos();
		const media = await repos.media.save(Buffer.from('image'), 'new-use.png', 'image/png');
		const list = repos.media.list.bind(repos.media);
		vi.spyOn(repos.media, 'list').mockImplementation(async () => {
			await createPost(repos, { title: 'New use', slug: 'new-use', contentMarkdown: `![](/api/media/${media.key})` });
			return list();
		});
		expect(await cleanupOrphanMedia(repos.posts, repos.media, { apply: true, maintenance: true }))
			.toMatchObject({ skipped: 1, deleted: 0 });
		expect(await repos.media.load(media.key)).not.toBeNull();
	});

	it('conservatively preserves absolute URL references and ambiguous mentions instead of risking data loss', async () => {
		const repos = createTestRepos();
		const absolute = await repos.media.save(Buffer.from('image'), 'absolute.png', 'image/png');
		const cover = await repos.media.save(Buffer.from('image'), 'cover.png', 'image/png');
		const mention = await repos.media.save(Buffer.from('image'), 'mentioned.png', 'image/png');
		await createPost(repos, { title: 'Absolute images', slug: 'absolute-images',
			contentMarkdown: `![absolute](https://site.example/api/media/${absolute.key})\n\n\`${mention.key}\``,
			coverImage: `https://site.example/api/media/${cover.key}` });
		expect(await cleanupOrphanMedia(repos.posts, repos.media, { apply: true, maintenance: true }))
			.toMatchObject({ orphaned: 0, deleted: 0 });
		expect(await repos.media.list()).toHaveLength(3);
	});
});
