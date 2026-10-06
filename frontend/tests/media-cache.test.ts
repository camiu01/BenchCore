/**
 * @file media-cache.test.ts
 * @brief Private browser revalidation never inherits shared or immutable upstream policies.
 */
import { describe, expect, it } from 'vitest';
import { mediaCacheHeaders } from '../src/lib/server/media-cache.js';

describe('media cache allowlist', () => {
	it('permits only exact private revalidation with a valid content hash', () => {
		const etag = `"sha256-${'a'.repeat(64)}"`;
		expect(
			mediaCacheHeaders(
				new Headers({ etag, 'cache-control': 'private, no-cache, must-revalidate' })
			)
		).toMatchObject({
			etag,
			'cache-control': 'private, no-cache, must-revalidate',
			vary: 'Cookie',
			'vercel-cdn-cache-control': 'no-store'
		});
		for (const policy of ['public, max-age=31536000, immutable', 'private, no-store', 'no-cache']) {
			expect(mediaCacheHeaders(new Headers({ etag, 'cache-control': policy }))).not.toHaveProperty(
				'etag'
			);
		}
		expect(
			mediaCacheHeaders(
				new Headers({ etag: 'unsafe', 'cache-control': 'private, no-cache, must-revalidate' })
			)
		).toHaveProperty('cache-control', 'private, no-store');
	});
});
