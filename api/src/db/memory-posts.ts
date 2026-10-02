/**
 * @file memory-posts.ts
 * @brief In-memory post repository for database-independent service tests.
 */
import type { PostCreate, PostRepository, PostWithTags, TagRepository } from './repositories.js';
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

/** @brief In-memory implementation of the post repository contract. */
class MemoryPosts implements PostRepository {
	private readonly rows = new Map<string, PostRow>();

	/**
	 * @brief Retains tag and link stores.
	 * @param tags The tag repository.
	 * @param links Shared post-tag links.
	 */
	constructor(private readonly tags: TagRepository, private readonly links: Map<string, Set<string>>) {}

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
			...input, category: input.category ?? null, publishAt: input.publishAt ?? null,
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
			row.status === 'published' && row.publishedAt !== null && row.publishedAt <= options.now
			&& (row.publishAt === null || row.publishAt <= options.now) && matchesSearch(row, options.search)));
		const filtered: PostRow[] = [];
		for (const row of visible) {
			const names = options.tag === undefined ? [] : await this.tags.getPostTagNames(row.id);
			if (options.tag === undefined || names.includes(options.tag)) { filtered.push(row); }
		}
		const page = filtered.slice(options.offset, options.offset + options.limit);
		return { items: await Promise.all(page.map((row) => this.withTags(row))), total: filtered.length };
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
}

/**
 * @brief Creates the in-memory post repository.
 * @param tags The tag repository.
 * @param links Shared post-tag links.
 * @return The post repository.
 */
export function createMemoryPosts(tags: TagRepository, links: Map<string, Set<string>>): PostRepository {
	return new MemoryPosts(tags, links);
}
