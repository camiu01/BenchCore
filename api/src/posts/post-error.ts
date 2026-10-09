/**
 * @file post-error.ts
 * @brief Post domain errors carrying an English diagnostic and a translatable API message.
 */
import type { ApiMessageKey, MessageParams } from '../i18n/index.js';

/**
 * @brief Domain error with a machine-readable code.
 */
export class PostError extends Error {
	code: 'not_found' | 'validation' | 'transition' | 'conflict';
	localized: { key: ApiMessageKey; params?: MessageParams } | undefined;

	/**
	 * @brief Builds a post domain error.
	 * @param code The error code.
	 * @param message The English diagnostic message.
	 * @param localized Translatable message for API responses.
	 */
	constructor(code: PostError['code'], message: string, localized?: PostError['localized']) {
		super(message);
		this.code = code;
		this.localized = localized;
	}
}

/**
 * @brief Builds the duplicate-slug error.
 * @param slug The slug already in use.
 * @return A conflict error with a translatable message.
 */
export function slugConflict(slug: string): PostError {
	return new PostError('conflict', `slug already exists: ${slug}`, {
		key: 'post.slug_exists',
		params: { slug }
	});
}

/**
 * @brief Builds the missing-post error.
 * @param id The requested post id.
 * @return A not-found error with a translatable message.
 */
export function postNotFound(id: string): PostError {
	return new PostError('not_found', `post not found: ${id}`, {
		key: 'post.not_found',
		params: { id }
	});
}
