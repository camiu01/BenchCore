/**
 * @file memory-engagement.ts
 * @brief In-memory comment and like persistence for isolated tests.
 */
import type { CommentRepository, LikeRepository } from './repositories.js';
import type { CommentRow } from './schema.js';

/** @brief Creates in-memory comments. @return Repository. */
export function createMemoryComments(): CommentRepository {
	const rows = new Map<string, CommentRow>();
	return {
		/** @brief Creates a pending comment. @param input Fields. @return Row. */
		async create(input) {
			const row: CommentRow = { ...input, status: 'pending', createdAt: new Date() };
			rows.set(row.id, row);
			return row;
		},
		/** @brief Lists approved comments with lookahead. @param postId Post. @param offset Row offset. @return Rows. */
		async listApproved(postId, offset = 0) {
			return [...rows.values()].filter((row) => row.postId === postId && row.status === 'approved')
				.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
				.slice(offset, offset + 101);
		},
		/** @brief Lists comments with lookahead. @param status Optional status. @param offset Row offset. @return Rows. */
		async listByStatus(status, offset = 0) {
			return [...rows.values()].filter((row) => !status || row.status === status)
				.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
				.slice(offset, offset + 101);
		},
		/** @brief Changes status. @param id Comment. @param status State. @return Row or null. */
		async setStatus(id, status) {
			const row = rows.get(id);
			if (!row) { return null; }
			const updated = { ...row, status };
			rows.set(id, updated);
			return updated;
		},
		/** @brief Removes a comment. @param id Comment. @return Whether removed. */
		async remove(id) { return rows.delete(id); },
		/** @brief Counts pending comments. @return Count. */
		async countPending() { return [...rows.values()].filter((row) => row.status === 'pending').length; }
	};
}

/** @brief Creates in-memory likes. @return Repository. */
export function createMemoryLikes(): LikeRepository {
	const rows = new Set<string>();
	return {
		/** @brief Toggles a voter row. @param postId Post. @param voterHash Digest. @return Liked state. */
		async toggle(postId, voterHash) {
			const key = `${postId}\0${voterHash}`;
			if (rows.delete(key)) { return false; }
			rows.add(key);
			return true;
		},
		/** @brief Checks a voter row. @param postId Post. @param voterHash Digest. @return Whether liked. */
		async has(postId, voterHash) { return rows.has(`${postId}\0${voterHash}`); },
		/** @brief Counts post likes. @param postId Post. @return Count. */
		async count(postId) {
			return [...rows].filter((key) => key.startsWith(`${postId}\0`)).length;
		}
	};
}
