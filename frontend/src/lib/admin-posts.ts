/**
 * @file admin-posts.ts
 * @brief Presentation-only filtering and status counts for the loaded admin posts.
 */
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
