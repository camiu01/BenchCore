/**
 * @file drizzle.ts
 * @brief Drizzle-backed user, session and tag repositories with post wiring.
 */
import { eq, lte, or } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { AppDb } from './client.js';
import { createDrizzlePosts } from './drizzle-posts.js';
import { createDrizzleComments, createDrizzleLikes } from './drizzle-engagement.js';
import type {
	PostRepository,
	SessionRepository,
	TagRepository,
	UserRepository,
	CommentRepository,
	LikeRepository
} from './repositories.js';
import { postTags, sessions, tags, users, type TagRow } from './schema.js';

export { createDrizzlePosts } from './drizzle-posts.js';
import { createDrizzleUsers } from './drizzle-users.js';
export { createDrizzleUsers } from './drizzle-users.js';

/**
 * @brief Creates the Drizzle session repository.
 * @param db The database handle.
 * @return The repository.
 */
export function createDrizzleSessions(db: AppDb): SessionRepository {
	return {
		/** @brief Creates a session. @param input Session fields. @return The created row. */
		async create(input: { id: string; tokenHash: string; userId: string; expiresAt: Date; userVersion?: number }) {
			const rows = await db.insert(sessions).values(input).returning();
			const row = rows[0];
			if (row === undefined) {
				throw new Error('session insert returned no row');
			}
			return row;
		},
		/** @brief Resolves session ownership. @param tokenHash The hash. @return The joined row or null. */
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
		/** @brief Deletes a session. @param tokenHash The hash. @return Completion. */
		async deleteByTokenHash(tokenHash: string): Promise<void> {
			await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
		},
		/** @brief Deletes expired sessions. @param now The reference time. @return The deletion count. */
		async deleteExpired(now: Date): Promise<number> {
			const rows = await db.delete(sessions).where(lte(sessions.expiresAt, now)).returning();
			return rows.length;
		}
	};
}

/** @brief SQL-backed tags with deduplicated transactional link replacement. */
class DrizzleTags implements TagRepository {
	/** @brief Retains the database. @param db The database handle. */
	constructor(private readonly db: AppDb) {}

	/** @brief Lists tags. @return Rows ordered by name. */
	async list(): Promise<TagRow[]> {
		return this.db.select().from(tags).orderBy(tags.name);
	}

	/** @brief Changes a tag color. @param id Tag id. @param color HEX color. @return Updated row or null. */
	async updateColor(id: string, color: string): Promise<TagRow | null> {
		return (await this.db.update(tags).set({ color }).where(eq(tags.id, id)).returning())[0] ?? null;
	}

	/** @brief Deletes a tag; database cascades its links. @param id Tag id. @return Whether deleted. */
	async remove(id: string): Promise<boolean> {
		return (await this.db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id })).length > 0;
	}

	/**
	 * @brief Resolves names and slug aliases without duplicate result ids.
	 * @param names The submitted tag names.
	 * @return The canonical tag rows.
	 */
	async upsertByName(names: string[]): Promise<TagRow[]> {
		const result: TagRow[] = [];
		for (const raw of names) {
			const name = raw.trim();
			if (name === '') { continue; }
			const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
			await this.db.insert(tags).values({ id: randomUUID(), slug: slug || randomUUID(), name }).onConflictDoNothing();
			const rows = await this.db.select().from(tags).where(or(eq(tags.name, name), eq(tags.slug, slug))).limit(1);
			const row = rows[0];
			if (row !== undefined && !result.some((tag) => tag.id === row.id)) { result.push(row); }
		}
		return result;
	}

	/**
	 * @brief Replaces links atomically and ignores duplicate ids.
	 * @param postId The post id.
	 * @param tagIds The desired tag ids.
	 * @return Completion.
	 */
	async setPostTags(postId: string, tagIds: string[]): Promise<void> {
		await this.db.transaction(async (tx) => {
			await tx.delete(postTags).where(eq(postTags.postId, postId));
			const ids = [...new Set(tagIds)];
			if (ids.length > 0) { await tx.insert(postTags).values(ids.map((tagId) => ({ postId, tagId }))); }
		});
	}

	/**
	 * @brief Loads the names linked to a post.
	 * @param postId The post id.
	 * @return Sorted tag names.
	 */
	async getPostTagNames(postId: string): Promise<string[]> {
		const rows = await this.db.select({ name: tags.name }).from(postTags)
			.innerJoin(tags, eq(postTags.tagId, tags.id)).where(eq(postTags.postId, postId)).orderBy(tags.name);
		return rows.map((row) => row.name);
	}
}

/**
 * @brief Creates the Drizzle tag repository.
 * @param db The database handle.
 * @return The repository.
 */
export function createDrizzleTags(db: AppDb): TagRepository {
	return new DrizzleTags(db);
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
	comments: CommentRepository;
	likes: LikeRepository;
} {
	const users = createDrizzleUsers(db);
	const sessions = createDrizzleSessions(db);
	const tags = createDrizzleTags(db);
	return {
		users,
		sessions,
		posts: createDrizzlePosts(db, tags),
		tags,
		comments: createDrizzleComments(db),
		likes: createDrizzleLikes(db)
	};
}
