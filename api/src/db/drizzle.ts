/**
 * @file drizzle.ts
 * @brief Drizzle-backed repository implementations. Only this module holds SQL.
 */
import { and, count, desc, eq, inArray, lte } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { AppDb } from './client.js';
import type {
	PostRepository,
	PostWithTags,
	SessionRepository,
	TagRepository,
	UserRepository
} from './repositories.js';
import { posts, postTags, sessions, tags, users, type PostRow, type UserRow } from './schema.js';

/**
 * @brief Creates the Drizzle user repository.
 * @param db The database handle.
 * @return The repository.
 */
export function createDrizzleUsers(db: AppDb): UserRepository {
	return {
		async findByEmail(email: string) {
			const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
			return rows[0] ?? null;
		},
		async findById(id: string) {
			const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
			return rows[0] ?? null;
		},
		async create(input: Omit<UserRow, 'createdAt'>) {
			const rows = await db.insert(users).values(input).returning();
			const row = rows[0];
			if (row === undefined) {
				throw new Error('user insert returned no row');
			}
			return row;
		}
	};
}

/**
 * @brief Creates the Drizzle session repository.
 * @param db The database handle.
 * @return The repository.
 */
export function createDrizzleSessions(db: AppDb): SessionRepository {
	return {
		async create(input: { id: string; tokenHash: string; userId: string; expiresAt: Date }) {
			const rows = await db.insert(sessions).values(input).returning();
			const row = rows[0];
			if (row === undefined) {
				throw new Error('session insert returned no row');
			}
			return row;
		},
		async findByTokenHash(tokenHash: string) {
			const rows = await db
				.select({ session: sessions, user: users })
				.from(sessions)
				.innerJoin(users, eq(sessions.userId, users.id))
				.where(eq(sessions.tokenHash, tokenHash))
				.limit(1);
			const row = rows[0];
			return row === undefined ? null : { ...row.session, user: row.user };
		},
		async deleteByTokenHash(tokenHash: string): Promise<void> {
			await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
		},
		async deleteExpired(now: Date): Promise<number> {
			const rows = await db.delete(sessions).where(lte(sessions.expiresAt, now)).returning();
			return rows.length;
		}
	};
}

/**
 * @brief Creates the Drizzle tag repository.
 * @param db The database handle.
 * @return The repository.
 */
export function createDrizzleTags(db: AppDb): TagRepository {
	return {
		async list() {
			return db.select().from(tags).orderBy(tags.name);
		},
		async upsertByName(names: string[]) {
			const result = [];
			for (const raw of names) {
				const name = raw.trim();
				if (name === '') {
					continue;
				}
				const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
				await db
					.insert(tags)
					.values({ id: randomUUID(), slug: slug === '' ? randomUUID() : slug, name })
					.onConflictDoNothing();
				const rows = await db.select().from(tags).where(eq(tags.name, name)).limit(1);
				const row = rows[0];
				if (row !== undefined) {
					result.push(row);
				}
			}
			return result;
		},
		async setPostTags(postId: string, tagIds: string[]): Promise<void> {
			await db.delete(postTags).where(eq(postTags.postId, postId));
			if (tagIds.length > 0) {
				await db.insert(postTags).values(tagIds.map((tagId) => ({ postId, tagId })));
			}
		},
		async getPostTagNames(postId: string): Promise<string[]> {
			const rows = await db
				.select({ name: tags.name })
				.from(postTags)
				.innerJoin(tags, eq(postTags.tagId, tags.id))
				.where(eq(postTags.postId, postId))
				.orderBy(tags.name);
			return rows.map((row) => row.name);
		}
	};
}

/**
 * @brief Creates the Drizzle post repository.
 * @param db The database handle.
 * @param tagRepo The tag repository used to attach tag names.
 * @return The repository.
 */
export function createDrizzlePosts(db: AppDb, tagRepo: TagRepository): PostRepository {
	/**
	 * @brief Attaches tag names to post rows.
	 * @param rows The post rows.
	 * @return The rows with tag names.
	 */
	async function withTags(rows: PostRow[]): Promise<PostWithTags[]> {
		const ids = rows.map((row) => row.id);
		const links =
			ids.length === 0
				? []
				: await db
						.select({ postId: postTags.postId, name: tags.name })
						.from(postTags)
						.innerJoin(tags, eq(postTags.tagId, tags.id))
						.where(inArray(postTags.postId, ids));
		const namesByPost = new Map<string, string[]>();
		for (const link of links) {
			const names = namesByPost.get(link.postId) ?? [];
			names.push(link.name);
			namesByPost.set(link.postId, names);
		}
		return rows.map((row) => ({ ...row, tags: (namesByPost.get(row.id) ?? []).sort() }));
	}

	return {
		async create(input: Omit<PostRow, 'createdAt' | 'updatedAt'>) {
			const rows = await db.insert(posts).values(input).returning();
			const row = rows[0];
			if (row === undefined) {
				throw new Error('post insert returned no row');
			}
			return row;
		},
		async update(id: string, patch: Partial<PostRow>) {
			const rows = await db
				.update(posts)
				.set({ ...patch, updatedAt: new Date() })
				.where(eq(posts.id, id))
				.returning();
			return rows[0] ?? null;
		},
		async remove(id: string): Promise<boolean> {
			const rows = await db.delete(posts).where(eq(posts.id, id)).returning({ id: posts.id });
			return rows.length > 0;
		},
		async findById(id: string) {
			const rows = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
			return rows[0] ?? null;
		},
		async findBySlug(slug: string) {
			const rows = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
			return rows[0] ?? null;
		},
		async listPublished(options: { limit: number; offset: number; tag?: string; now: Date }) {
			const visible = and(
				eq(posts.status, 'published'),
				lte(posts.publishedAt, options.now)
			);
			if (options.tag !== undefined) {
				const tagRows = await db.select().from(tags).where(eq(tags.name, options.tag)).limit(1);
				const tag = tagRows[0];
				if (tag === undefined) {
					return { items: [], total: 0 };
				}
				const linked = await db
					.select({ post: posts })
					.from(postTags)
					.innerJoin(posts, eq(postTags.postId, posts.id))
					.where(and(eq(postTags.tagId, tag.id), visible))
					.orderBy(desc(posts.publishedAt))
					.limit(options.limit)
					.offset(options.offset);
				const totalRows = await db
					.select({ value: count() })
					.from(postTags)
					.innerJoin(posts, eq(postTags.postId, posts.id))
					.where(and(eq(postTags.tagId, tag.id), visible));
				return { items: await withTags(linked.map((row) => row.post)), total: totalRows[0]?.value ?? 0 };
			}
			const rows = await db
				.select()
				.from(posts)
				.where(visible)
				.orderBy(desc(posts.publishedAt))
				.limit(options.limit)
				.offset(options.offset);
			const totalRows = await db.select({ value: count() }).from(posts).where(visible);
			return { items: await withTags(rows), total: totalRows[0]?.value ?? 0 };
		},
		async listAll() {
			const rows = await db.select().from(posts).orderBy(desc(posts.createdAt));
			return withTags(rows);
		}
	};
}

/**
 * @brief Wires every Drizzle repository from one database handle.
 * @param db The database handle.
 * @return The repository set.
 */
export function createDrizzleRepos(db: AppDb): {
	users: UserRepository;
	sessions: SessionRepository;
	posts: PostRepository;
	tags: TagRepository;
} {
	const users = createDrizzleUsers(db);
	const sessions = createDrizzleSessions(db);
	const tags = createDrizzleTags(db);
	return { users, sessions, posts: createDrizzlePosts(db, tags), tags };
}
