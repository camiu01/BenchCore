/**
 * @file engagement-service.ts
 * @brief Public comments, moderation and anonymous post likes.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { CommentRepository, PostRepository } from '../db/repositories.js';
import type { CommentRow, PostRow } from '../db/schema.js';
import { isPublic, normalizeSlug } from './publishing.js';

export const commentSchema = z.object({
	authorName: z.string().trim().min(2).max(80),
	content: z.string().trim().min(2).max(2_000)
}).strict();
export const moderationSchema = z.object({
	status: z.enum(['pending', 'approved', 'rejected'])
}).strict();

/** @brief A safe public comment. */
export interface PublicComment {
	id: string;
	authorName: string;
	content: string;
	createdAt: string;
}

/**
 * @brief Finds a currently public post.
 * @param posts Persistence.
 * @param slug Requested slug.
 * @param now Reference time.
 * @return Visible row or null.
 */
export async function findPublicPost(posts: PostRepository, slug: string, now: Date = new Date()):
	Promise<PostRow | null> {
	const post = await posts.findBySlug(normalizeSlug(slug));
	return post && isPublic(post.status, post.publishedAt, now) ? post : null;
}

/** @brief Maps a stored comment to its public DTO. @param row Stored row. @return Public comment. */
export function publicComment(row: CommentRow): PublicComment {
	return {
		id: row.id,
		authorName: row.authorName,
		content: row.content,
		createdAt: row.createdAt.toISOString()
	};
}

/**
 * @brief Creates a pending comment.
 * @param comments Persistence.
 * @param postId Public post id.
 * @param input Validated fields.
 * @return Created pending row.
 */
export function createComment(comments: CommentRepository, postId: string,
	input: z.infer<typeof commentSchema>): Promise<CommentRow> {
	return comments.create({ id: randomUUID(), postId, ...input });
}
