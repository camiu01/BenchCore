/**
 * @file admin-posts.ts
 * @brief Presentation-only filtering and status counts for the loaded admin posts.
 */
import type { MessageKey } from './i18n/translate.js';

/** Display labels for post statuses; the status values themselves stay API data. */
export const postStatusKeys = {
	draft: 'admin.stamp.draft',
	published: 'admin.stamp.published',
	archived: 'admin.stamp.archived'
} as const satisfies Record<string, MessageKey>;

/** Display labels for comment moderation statuses. */
export const commentStatusKeys = {
	pending: 'admin.comments.status.pending',
	approved: 'admin.comments.status.approved',
	rejected: 'admin.comments.status.rejected'
} as const satisfies Record<string, MessageKey>;

/** Moderation button labels keyed by the status they apply. */
export const commentActionKeys = {
	approved: 'admin.comments.approve',
	rejected: 'admin.comments.reject',
	pending: 'admin.comments.markPending'
} as const satisfies Record<string, MessageKey>;

interface PostSummary {
	title: string;
	slug: string;
	status: 'draft' | 'published' | 'archived';
}

/** @brief Filters the loaded post list. @param posts Loaded posts. @param query Title or slug search. @param status Status filter or all. @return Matching posts in their original order. */
export function filterAdminPosts<T extends PostSummary>(
	posts: T[],
	query: string,
	status: string
): T[] {
	const needle = query.trim().toLowerCase();
	return posts.filter(
		(post) =>
			(status === 'all' || post.status === status) &&
			(post.title.toLowerCase().includes(needle) || post.slug.toLowerCase().includes(needle))
	);
}

/** @brief Counts statuses in the loaded page, not the entire archive. @param posts Loaded posts. @return Counts for the filter controls. */
export function adminPostCounts(posts: PostSummary[]) {
	const counts = { all: posts.length, draft: 0, published: 0, archived: 0 };
	for (const post of posts) counts[post.status] += 1;
	return counts;
}
