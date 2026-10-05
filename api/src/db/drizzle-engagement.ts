/**
 * @file drizzle-engagement.ts
 * @brief PostgreSQL comment moderation and anonymous like persistence.
 */
import { count, desc, eq, and, sql } from 'drizzle-orm';
import type { AppDb } from './client.js';
import type { CommentRepository, LikeRepository } from './repositories.js';
import { comments, likes } from './schema.js';

/** @brief Creates SQL-backed comment persistence. @param db Database. @return Repository. */
export function createDrizzleComments(db: AppDb): CommentRepository {
	return {
		/** @brief Creates a pending comment. @param input Fields. @return Created row. */
		async create(input) {
			const row = (await db.insert(comments).values(input).returning())[0];
			if (!row) { throw new Error('comment insert returned no row'); }
			return row;
		},
		/** @brief Lists approved comments with lookahead. @param postId Post id. @param offset Row offset. @return Rows. */
		listApproved: (postId, offset = 0) => db.select().from(comments)
			.where(and(eq(comments.postId, postId), eq(comments.status, 'approved')))
			.orderBy(comments.createdAt, comments.id).limit(101).offset(offset),
		/** @brief Lists comments with lookahead. @param status Filter. @param offset Row offset. @return Rows. */
		listByStatus: (status, offset = 0) => db.select().from(comments)
			.where(status ? eq(comments.status, status) : undefined)
			.orderBy(desc(comments.createdAt), desc(comments.id)).limit(101).offset(offset),
		/** @brief Changes moderation status. @param id Comment id. @param status State. @return Row or null. */
		async setStatus(id, status) {
			return (await db.update(comments).set({ status }).where(eq(comments.id, id)).returning())[0] ?? null;
		},
		/** @brief Deletes a comment. @param id Comment id. @return Whether deleted. */
		async remove(id) {
			return (await db.delete(comments).where(eq(comments.id, id)).returning({ id: comments.id })).length > 0;
		},
		/** @brief Counts pending comments. @return Pending count. */
		async countPending() {
			return (await db.select({ total: count() }).from(comments)
				.where(eq(comments.status, 'pending')))[0]?.total ?? 0;
		}
	};
}

/** @brief Creates SQL-backed anonymous likes. @param db Database. @return Repository. */
export function createDrizzleLikes(db: AppDb): LikeRepository {
	return {
		/** @brief Toggles one voter row atomically. @param postId Post. @param voterHash Voter digest. @return Liked state. */
		async toggle(postId, voterHash) {
			return db.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`${postId}:${voterHash}`}, 0))`
				);
				const removed = await tx.delete(likes).where(and(eq(likes.postId, postId), eq(likes.voterHash, voterHash)))
					.returning({ postId: likes.postId });
				if (removed[0]) { return false; }
				await tx.insert(likes).values({ postId, voterHash });
				return true;
			});
		},
		/** @brief Checks a voter row. @param postId Post. @param voterHash Digest. @return Whether liked. */
		async has(postId, voterHash) {
			return (await db.select({ postId: likes.postId }).from(likes)
				.where(and(eq(likes.postId, postId), eq(likes.voterHash, voterHash))).limit(1))[0] !== undefined;
		},
		/** @brief Counts post likes. @param postId Post. @return Count. */
		async count(postId) {
			return (await db.select({ total: count() }).from(likes).where(eq(likes.postId, postId)))[0]?.total ?? 0;
		}
	};
}
