/**
 * @file posts-query.ts
 * @brief Shareable archive state and filter-preserving pagination.
 */
import { z } from 'zod';
import { DEFAULT_LOCALE } from './i18n/locale.js';
import { translator } from './i18n/translate.js';

const archiveSchema = z.object({
	page: z.coerce.number().int().min(1).max(100001).catch(1),
	search: z.string().trim().max(200).catch(''),
	tags: z
		.array(z.string().trim().min(1).max(60))
		.max(20)
		.catch([])
		.transform((values) => [...new Set(values)]),
	tagMode: z.enum(['and', 'or']).catch('and'),
	sort: z.enum(['published', 'updated', 'popular']).catch('published')
});
export type ArchiveQuery = z.infer<typeof archiveSchema>;

/** @brief Normalizes bookmarkable archive controls without accepting unbounded values. @param query URL parameters. @return Bounded state. */
export function archiveQuery(query: URLSearchParams): ArchiveQuery {
	return archiveSchema.parse({
		page: query.get('page'),
		search: query.get('search') ?? '',
		tags: [...query.getAll('tag'), ...query.getAll('tags')],
		tagMode: query.get('tagMode'),
		sort: query.get('sort')
	});
}

/** @brief Builds a safe link which preserves all current archive filters. @param query Current filters. @param page Target page. @return Local archive URL. */
export function archiveHref(query: ArchiveQuery, page = query.page): string {
	const params = new URLSearchParams();
	if (page > 1) params.set('page', String(page));
	if (query.search) params.set('search', query.search);
	for (const tag of query.tags) params.append('tag', tag);
	if (query.tagMode === 'or') params.set('tagMode', 'or');
	if (query.sort !== 'published') params.set('sort', query.sort);
	return `/posts${params.size ? `?${params}` : ''}`;
}

/** @brief Describes the active sort without claiming newest-first for other orders. @param sort Sort key. @param tr Message translator. @return Reader label. */
export function archiveSortLabel(
	sort: ArchiveQuery['sort'],
	tr: ReturnType<typeof translator> = translator(DEFAULT_LOCALE)
): string {
	return tr(`public.posts.sort.${sort}`);
}
