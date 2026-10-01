/**
 * @file publishing.ts
 * @brief Centralized post publishing rules. Single home for visibility logic.
 */
import type { PostStatus } from '../db/schema.js';

/**
 * @brief Allowed status transitions (same-state is always allowed).
 */
const TRANSITIONS: Record<PostStatus, PostStatus[]> = {
	draft: ['published', 'archived'],
	published: ['archived', 'draft'],
	archived: ['published', 'draft']
};

/**
 * @brief Decides whether a post is publicly visible.
 * @param status The post status.
 * @param publishedAt The scheduled publication time, if any.
 * @param now The reference time.
 * @return True only for published posts whose date has passed.
 */
export function isPublic(
	status: PostStatus,
	publishedAt: Date | null,
	now: Date = new Date()
): boolean {
	return status === 'published' && publishedAt !== null && publishedAt <= now;
}

/**
 * @brief Decides whether a status change is legal.
 * @param from The current status.
 * @param to The desired status.
 * @return True when the transition is allowed.
 */
export function canTransition(from: PostStatus, to: PostStatus): boolean {
	if (from === to) {
		return true;
	}
	return TRANSITIONS[from].includes(to);
}

/**
 * @brief Normalizes a slug for comparison and storage.
 * @param raw The raw slug value.
 * @return The trimmed lowercase slug.
 */
export function normalizeSlug(raw: string): string {
	return raw.trim().toLowerCase();
}
