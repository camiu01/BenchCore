/**
 * Typed read client for the standalone API. Server-only: load functions,
 * server routes and hooks (uses process.env, no $env module dependency).
 * Every response is validated with Zod; unreachable APIs resolve to null
 * so pages render an offline stamp instead of throwing 500s.
 */
import { z } from 'zod';

/**
 * @brief A public post list item DTO.
 */
export const postListItemSchema = z.object({
	id: z.string(),
	slug: z.string(),
	title: z.string(),
	description: z.string(),
	tags: z.array(z.string()),
	authorName: z.string().nullable(),
	publishedAt: z.string().nullable()
});

/**
 * @brief A public post list item.
 */
export type PostListItem = z.infer<typeof postListItemSchema>;

/**
 * @brief A paginated post list DTO.
 */
export const postsPageSchema = z.object({
	items: z.array(postListItemSchema),
	total: z.number()
});

/**
 * @brief A paginated post list.
 */
export type PostsPage = z.infer<typeof postsPageSchema>;

/**
 * @brief A backlink DTO (Obsidian-style incoming [[wikilink]]).
 */
export const backlinkSchema = z.object({
	slug: z.string(),
	title: z.string()
});

/**
 * @brief A public post detail DTO.
 */
export const postDetailSchema = postListItemSchema.extend({
	contentHtml: z.string(),
	coverImage: z.string().nullable(),
	readingMinutes: z.number(),
	backlinks: z.array(backlinkSchema)
});

/**
 * @brief A public post detail.
 */
export type PostDetail = z.infer<typeof postDetailSchema>;

/**
 * @brief A tag with its published-post count DTO.
 */
export const tagWithCountSchema = z.object({
	name: z.string(),
	slug: z.string(),
	count: z.number()
});

/**
 * @brief A tag with its published-post count.
 */
export type TagWithCount = z.infer<typeof tagWithCountSchema>;

/**
 * @brief Returns the API base URL (falls back to local dev default).
 * @returns The configured API base URL.
 */
export function apiBase(): string {
	return process.env['PUBLIC_API_URL'] || 'http://localhost:3001';
}

/**
 * @brief Resolves a media URL (absolute, media key or external) for rendering.
 * @param value The cover image value from the API.
 * @returns The absolute URL or null.
 */
export function resolveMediaUrl(value: string | null): string | null {
	if (value === null || value === '') {
		return null;
	}
	if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) {
		return value;
	}
	return `${apiBase()}/api/media/${value}`;
}

/**
 * @brief GETs and validates a JSON DTO from the API.
 * @param schema The Zod schema for the response.
 * @param path The API path starting with /api/.
 * @returns The validated DTO or null when unreachable/invalid.
 */
async function getDto<T>(schema: z.ZodType<T>, path: string): Promise<T | null> {
	try {
		const response = await fetch(`${apiBase()}${path}`);
		if (!response.ok) {
			return null;
		}
		const parsed = schema.safeParse(await response.json());
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

/**
 * @brief Loads the newest published posts.
 * @param limit The maximum number of items.
 * @returns The page DTO or null when the API is unreachable.
 */
export function getRecentPosts(limit = 5): Promise<PostsPage | null> {
	return getDto(postsPageSchema, `/api/posts?limit=${limit}&offset=0`);
}

/**
 * @brief Loads one page of published posts.
 * @param limit The page size.
 * @param offset The page offset.
 * @returns The page DTO or null when the API is unreachable.
 */
export function getPostsPage(limit: number, offset: number): Promise<PostsPage | null> {
	return getDto(postsPageSchema, `/api/posts?limit=${limit}&offset=${offset}`);
}

/**
 * @brief Loads one published post by slug.
 * @param slug The post slug.
 * @returns The detail DTO or null when missing/unreachable.
 */
export function getPostBySlug(slug: string): Promise<PostDetail | null> {
	return getDto(postDetailSchema, `/api/posts/${encodeURIComponent(slug)}`);
}

/**
 * @brief Loads published posts for a tag with pagination.
 * @param tag The tag name.
 * @param limit The page size.
 * @param offset The page offset.
 * @returns The page DTO or null when the API is unreachable.
 */
export function getPostsByTag(
	tag: string,
	limit: number,
	offset: number
): Promise<PostsPage | null> {
	return getDto(
		postsPageSchema,
		`/api/posts?limit=${limit}&offset=${offset}&tag=${encodeURIComponent(tag)}`
	);
}

/**
 * @brief Loads every tag with published-post counts.
 * @returns The tag list or null when the API is unreachable.
 */
export function getTags(): Promise<{ items: TagWithCount[] } | null> {
	return getDto(z.object({ items: z.array(tagWithCountSchema) }), '/api/tags');
}
