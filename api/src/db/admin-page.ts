/**
 * @file admin-page.ts
 * @brief Bounded administrator ledger query and result contracts.
 */
import type { PostWithTags } from './repositories.js';

export interface AdminPageQuery {
	limit: number;
	offset: number;
	search?: string | undefined;
	status?: 'draft' | 'published' | 'archived' | undefined;
}
export interface AdminPostCounts { all: number; draft: number; published: number; archived: number; }
export interface AdminPostPage { items: PostWithTags[]; total: number; counts: AdminPostCounts; }

/** @brief Escapes PostgreSQL LIKE metacharacters so searches remain literal. @param value Query text. @return Escaped substring pattern. */
export function adminSearchPattern(value: string): string {
	return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}
