/**
 * @file drizzle-posts.ts
 * @brief PostgreSQL post persistence, scheduled publishing and full-text queries.
 */
import { and, count, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { AppDb } from './client.js';
import type { PostCreate, PostRepository, PostWithTags, TagRepository } from './repositories.js';
import { posts, postTags, tags, type PostRow } from './schema.js';

/**
 * @brief Builds the shared public-post visibility predicate.
 * @param now Visibility reference time.
 * @return Drizzle SQL predicate.
 */
function publicPostFilter(now: Date) {
	return and(
		eq(posts.status, 'published'),
		lte(posts.publishedAt, now),
		or(isNull(posts.publishAt), lte(posts.publishAt, now))
	);
}

/** @brief SQL implementation of the post repository contract. */
class DrizzlePosts implements PostRepository {
	/**
	 * @brief Retains the database handle.
	 * @param db The database handle.
	 */
	constructor(private readonly db: AppDb) {}

	/**
	 * @brief Attaches tags in one batched query.
	 * @param rows The post rows.
	 * @return Rows with sorted tag names.
	 */
	private async withTags(rows: PostRow[]): Promise<PostWithTags[]> {
		const ids = rows.map((row) => row.id);
		const links = ids.length === 0 ? [] : await this.db
			.select({ postId: postTags.postId, name: tags.name }).from(postTags)
			.innerJoin(tags, eq(postTags.tagId, tags.id)).where(inArray(postTags.postId, ids));
		const namesByPost = new Map<string, string[]>();
		for (const link of links) {
			const names = namesByPost.get(link.postId) ?? [];
			names.push(link.name);
			namesByPost.set(link.postId, names);
		}
		return rows.map((row) => ({ ...row, tags: (namesByPost.get(row.id) ?? []).sort() }));
	}

	/**
	 * @brief Creates a post, leaving generated columns to PostgreSQL.
	 * @param input The writable creation fields.
	 * @return The inserted row.
	 */
	async create(input: PostCreate): Promise<PostRow> {
		const { searchVector: _generated, ...fields } = input;
		const rows = await this.db.insert(posts).values(fields).returning();
		if (rows[0] === undefined) { throw new Error('post insert returned no row'); }
		return rows[0];
	}

	/**
	 * @brief Updates writable fields while preserving identity and creation time.
	 * @param id The post id.
	 * @param patch The changed fields.
	 * @return The updated row or null.
	 */
	async update(id: string, patch: Partial<PostRow>): Promise<PostRow | null> {
		const { searchVector: _generated, id: _id, createdAt: _created, ...fields } = patch;
		const rows = await this.db.update(posts).set({ ...fields, updatedAt: new Date() })
			.where(eq(posts.id, id)).returning();
		return rows[0] ?? null;
	}

	/**
	 * @brief Deletes a post.
	 * @param id The post id.
	 * @return Whether a row was deleted.
	 */
	async remove(id: string): Promise<boolean> {
		const rows = await this.db.delete(posts).where(eq(posts.id, id)).returning({ id: posts.id });
		return rows.length > 0;
	}

	/**
	 * @brief Finds a post regardless of publication status.
	 * @param id The post id.
	 * @return The post or null.
	 */
	async findById(id: string): Promise<PostRow | null> {
		const rows = await this.db.select().from(posts).where(eq(posts.id, id)).limit(1);
		return rows[0] ?? null;
	}

	/**
	 * @brief Finds a post regardless of publication status.
	 * @param slug The post slug.
	 * @return The post or null.
	 */
	async findBySlug(slug: string): Promise<PostRow | null> {
		const rows = await this.db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
		return rows[0] ?? null;
	}

	/**
	 * @brief Lists visible posts using identical item and count predicates.
	 * @param options Pagination, reference time and optional filters.
	 * @return The matching page and total.
	 */
	async listPublished(options: Parameters<PostRepository['listPublished']>[0]) {
		const search = options.search?.trim();
		const tagFilter = options.tag === undefined ? undefined : inArray(posts.id,
			this.db.select({ postId: postTags.postId }).from(postTags)
				.innerJoin(tags, eq(postTags.tagId, tags.id)).where(eq(tags.name, options.tag)));
		const visible = and(publicPostFilter(options.now), tagFilter,
			search ? sql`${posts.searchVector} @@ websearch_to_tsquery('simple', ${search})` : undefined);
		const rows = await this.db.select().from(posts).where(visible)
			.orderBy(desc(posts.publishedAt), desc(posts.id)).limit(options.limit).offset(options.offset);
		const totals = await this.db.select({ value: count() }).from(posts).where(visible);
		return { items: await this.withTags(rows), total: totals[0]?.value ?? 0 };
	}

	/**
	 * @brief Lists every row satisfying public visibility.
	 * @param now Visibility reference time.
	 * @return Public rows with tags.
	 */
	async listGraph(now: Date): Promise<PostWithTags[]> {
		const visible = publicPostFilter(now);
		return this.withTags(
			await this.db.select().from(posts).where(visible).orderBy(desc(posts.publishedAt), desc(posts.id))
		);
	}

	/**
	 * @brief Publishes due drafts with one atomic update.
	 * @param now The reference time.
	 * @return The number of published drafts.
	 */
	async publishDue(now: Date): Promise<number> {
		const rows = await this.db.update(posts)
			.set({ status: 'published', publishedAt: posts.publishAt, publishAt: null, updatedAt: now })
			.where(and(eq(posts.status, 'draft'), lte(posts.publishAt, now))).returning({ id: posts.id });
		return rows.length;
	}

	/**
	 * @brief Lists all posts for administration.
	 * @return The rows with tag names.
	 */
	async listAll(): Promise<PostWithTags[]> {
		return this.withTags(await this.db.select().from(posts).orderBy(desc(posts.createdAt), desc(posts.id)));
	}

	/**
	 * @brief Lists a bounded lightweight post index.
	 * @param limit Maximum rows.
	 * @return Suggestion fields only.
	 */
	async listSuggestions(limit: number) {
		return this.db
			.select({ id: posts.id, slug: posts.slug, title: posts.title })
			.from(posts)
			.orderBy(desc(posts.updatedAt), desc(posts.id))
			.limit(limit);
	}
}

/**
 * @brief Creates the PostgreSQL post repository.
 * @param db The database handle.
 * @param _tagRepo The tag repository retained for API compatibility.
 * @return The post repository.
 */
export function createDrizzlePosts(db: AppDb, _tagRepo: TagRepository): PostRepository {
	return new DrizzlePosts(db);
}
