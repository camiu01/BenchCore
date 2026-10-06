/**
 * @file memory-posts.ts
 * @brief In-memory post repository for database-independent service tests.
 */
import type { LikeRepository, PostCreate, PostRepository, PostWithTags, TagRepository } from './repositories.js';
import type { PostRow } from './schema.js';
import { matchesSearch } from './search.js';

/**
 * @brief Orders posts by publication date with a stable id tiebreaker.
 * @param rows The rows to sort.
 * @return Sorted rows.
 */
function newestFirst(rows: PostRow[]): PostRow[] {
	return [...rows].sort((a, b) =>
		(b.publishedAt ?? b.createdAt).getTime() - (a.publishedAt ?? a.createdAt).getTime()
		|| b.id.localeCompare(a.id));
}

/**
 * @brief Checks whether a post is public at the reference time.
 * @param row Post row.
 * @param now Visibility reference time.
 * @return Whether the row may be exposed publicly.
 */
function isPublic(row: PostRow, now: Date): boolean {
	return row.status === 'published' && row.publishedAt !== null && row.publishedAt <= now
		&& (row.publishAt === null || row.publishAt <= now);
}

/** @brief In-memory implementation of the post repository contract. */
class MemoryPosts implements PostRepository {
	private readonly rows = new Map<string, PostRow>();

	/**
	 * @brief Retains tag and link stores.
	 * @param tags The tag repository.
	 * @param links Shared post-tag links.
	 */
	constructor(private readonly tags: TagRepository, private readonly links: Map<string, Set<string>>,
		private readonly likes?: LikeRepository) {}

	/**
	 * @brief Attaches tag names to a row.
	 * @param row The post row.
	 * @return The row and its tags.
	 */
	private async withTags(row: PostRow): Promise<PostWithTags> {
		return { ...row, tags: await this.tags.getPostTagNames(row.id) };
	}

	/**
	 * @brief Creates a row with defaults matching PostgreSQL.
	 * @param input The post fields.
	 * @return The created row.
	 */
	async create(input: PostCreate): Promise<PostRow> {
		const now = new Date();
		const row: PostRow = {
			...input, audience: input.audience ?? 'public', category: input.category ?? null, publishAt: input.publishAt ?? null,
			searchVector: `${input.title} ${input.description} ${input.contentMarkdown}`,
			createdAt: now, updatedAt: now
		};
		this.rows.set(row.id, row);
		return row;
	}

	/**
	 * @brief Updates a row while preserving generated fields and identity.
	 * @param id The post id.
	 * @param patch The changed fields.
	 * @return The row or null.
	 */
	async update(id: string, patch: Partial<PostRow>): Promise<PostRow | null> {
		const row = this.rows.get(id);
		if (row === undefined) { return null; }
		const next = { ...row, ...patch, id: row.id, createdAt: row.createdAt, updatedAt: new Date() };
		next.searchVector = `${next.title} ${next.description} ${next.contentMarkdown}`;
		this.rows.set(id, next);
		return next;
	}

	/**
	 * @brief Removes a post and its tag links.
	 * @param id The post id.
	 * @return Whether a row was removed.
	 */
	async remove(id: string): Promise<boolean> {
		this.links.delete(id);
		return this.rows.delete(id);
	}

	/**
	 * @brief Finds a post regardless of publication status.
	 * @param id The post id.
	 * @return The row or null.
	 */
	async findById(id: string): Promise<PostRow | null> { return this.rows.get(id) ?? null; }

	/**
	 * @brief Replaces image references only when every post version matches.
	 * @param patches Expected versions and replacement fields.
	 * @return Whether every replacement was applied.
	 */
	async updateMediaReferences(patches: Parameters<PostRepository['updateMediaReferences']>[0]) {
		if (patches.some((patch) =>
			this.rows.get(patch.id)?.updatedAt.getTime() !== patch.expectedUpdatedAt.getTime())) return false;
		for (const { id, expectedUpdatedAt: _version, ...fields } of patches) {
			this.rows.set(id, { ...this.rows.get(id)!, ...fields, updatedAt: new Date() });
		}
		return true;
	}

	/**
	 * @brief Finds a post regardless of publication status.
	 * @param slug The post slug.
	 * @return The row or null.
	 */
	async findBySlug(slug: string): Promise<PostRow | null> {
		return [...this.rows.values()].find((row) => row.slug === slug) ?? null;
	}

	/**
	 * @brief Lists visible posts with tag, search and pagination filters.
	 * @param options Pagination, reference time and optional filters.
	 * @return The matching page and total.
	 */
	async listPublished(options: Parameters<PostRepository['listPublished']>[0]) {
		const visible = newestFirst([...this.rows.values()].filter((row) =>
			isPublic(row, options.now) && matchesSearch(
				row.audience === 'readers' && !options.includeReaderContent
					? { ...row, description: '', contentMarkdown: '', searchVector: row.title } : row,
				options.search)));
		const selected = [...new Set([...(options.tags ?? []), ...(options.tag ? [options.tag] : [])])];
		const filtered: PostWithTags[] = [];
		for (const row of visible) {
			const names = await this.tags.getPostTagNames(row.id);
			const matches = !selected.length || (options.tagMode === 'or'
				? selected.some((name) => names.includes(name)) : selected.every((name) => names.includes(name)));
			if (matches) filtered.push({ ...row, tags: names,
				likesCount: row.audience === 'readers' && !options.includeReaderContent ? 0 : await this.likes?.count(row.id) ?? 0 });
		}
		filtered.sort((a, b) => (options.sort === 'popular' ? (b.likesCount ?? 0) - (a.likesCount ?? 0)
			: options.sort === 'updated' ? b.updatedAt.getTime() - a.updatedAt.getTime() : 0)
			|| (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0) || b.id.localeCompare(a.id));
		const page = filtered.slice(options.offset, options.offset + options.limit);
		return { items: page, total: filtered.length };
	}

	/**
	 * @brief Lists every currently public row for graph construction.
	 * @param now Visibility reference time.
	 * @return Public rows with tags.
	 */
	async listGraph(now: Date): Promise<PostWithTags[]> {
		const rows = newestFirst([...this.rows.values()].filter((row) => isPublic(row, now)));
		return Promise.all(rows.map((row) => this.withTags(row)));
	}

	/**
	 * @brief Finds candidate rows mentioning a managed key.
	 * @param key Managed image key.
	 * @return Candidate post rows without tag attachment.
	 */
	async listMediaCandidates(key: string) {
		return [...this.rows.values()].filter((row) =>
			row.contentMarkdown.includes(key) || row.coverImage?.includes(key));
	}

	/**
	 * @brief Counts public posts once across all tag links.
	 * @param now Visibility reference time.
	 * @return Name-ordered tags with public post counts.
	 */
	async listTagCounts(now: Date) {
		const counts = new Map<string, number>();
		for (const row of this.rows.values()) {
			if (!isPublic(row, now)) continue;
			for (const tagId of this.links.get(row.id) ?? []) {
				counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
			}
		}
		return (await this.tags.list()).map((tag) => ({ ...tag, count: counts.get(tag.id) ?? 0 }));
	}

	/**
	 * @brief Publishes due drafts exactly once.
	 * @param now The reference time.
	 * @return The number of published drafts.
	 */
	async publishDue(now: Date): Promise<number> {
		let published = 0;
		for (const [id, row] of this.rows) {
			if (row.status !== 'draft' || row.publishAt === null || row.publishAt > now) { continue; }
			this.rows.set(id, { ...row, status: 'published', publishedAt: row.publishAt, publishAt: null, updatedAt: now });
			published += 1;
		}
		return published;
	}

	/**
	 * @brief Lists all posts for administration.
	 * @return Rows with tags, newest creation first.
	 */
	async listAll(): Promise<PostWithTags[]> {
		const rows = [...this.rows.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()
			|| b.id.localeCompare(a.id));
		return Promise.all(rows.map((row) => this.withTags(row)));
	}

	/** @brief Searches the protected ledger before slicing a stable page. @param options Page and filters. @return Page, total and search-wide counts. */
	async listAdmin(options: Parameters<PostRepository['listAdmin']>[0]) {
		const search = options.search?.trim().toLowerCase() ?? '';
		const matching = [...this.rows.values()].filter((row) =>
			row.title.toLowerCase().includes(search) || row.slug.toLowerCase().includes(search));
		const counts = { all: matching.length, draft: 0, published: 0, archived: 0 };
		for (const row of matching) counts[row.status]++;
		const filtered = matching.filter((row) => !options.status || row.status === options.status)
			.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id.localeCompare(a.id));
		const page = filtered.slice(options.offset, options.offset + options.limit);
		return { items: await Promise.all(page.map((row) => this.withTags(row))), total: filtered.length, counts };
	}

	/**
	 * @brief Lists a bounded lightweight post index.
	 * @param limit Maximum rows.
	 * @return Suggestion fields only.
	 */
	async listSuggestions(limit: number) {
		const rows = [...this.rows.values()]
			.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id.localeCompare(a.id))
			.slice(0, limit)
			.map(({ id, slug, title }) => ({ id, slug, title }));
		return Promise.all(rows.map(async (row) => ({ ...row, tags: await this.tags.getPostTagNames(row.id) })));
	}
}

/**
 * @brief Creates the in-memory post repository.
 * @param tags The tag repository.
 * @param links Shared post-tag links.
 * @param likes Optional shared like counters.
 * @return The post repository.
 */
export function createMemoryPosts(tags: TagRepository, links: Map<string, Set<string>>, likes?: LikeRepository): PostRepository {
	return new MemoryPosts(tags, links, likes);
}
