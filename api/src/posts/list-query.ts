/**
 * @file list-query.ts
 * @brief Bounded publication filters with repeated tags and deterministic ordering.
 */
import { z } from 'zod';

export const publishedQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(200).default(10),
	offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
	tags: z.array(z.string().trim().min(1).max(60)).max(20).default([])
		.transform((tags) => [...new Set(tags)]),
	tagMode: z.enum(['and', 'or']).default('and'),
	sort: z.enum(['published', 'updated', 'popular']).default('published'),
	search: z.string().trim().max(200).optional()
});

/** @brief Parses both the legacy tag and repeated tag(s) query fields. @param query URL parameters. @return Validated query result. */
export function parsePublishedQuery(query: URLSearchParams) {
	return publishedQuerySchema.safeParse({
		...Object.fromEntries(query),
		tags: [...query.getAll('tag'), ...query.getAll('tags')]
	});
}
