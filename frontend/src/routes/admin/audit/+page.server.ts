/**
 * @file +page.server.ts
 * @brief Protected and bounded security event history.
 */
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { auditPage } from '../../../lib/server/security-api.js';
import { serverT } from '../../../lib/server/server-t.js';
import type { PageServerLoad } from './$types';

/** @brief Loads one identifier-only history page. @param event Request and query. @return Validated history. */
export const load: PageServerLoad = async ({ request, url }) => {
	const offset = z
		.string()
		.regex(/^\d+$/)
		.transform(Number)
		.pipe(z.number().int().min(0).max(100_000))
		.safeParse(url.searchParams.get('offset') ?? '0');
	if (!offset.success) {
		error(400, serverT('auth.error.badFields'));
	}
	const page = await auditPage(request.headers.get('cookie'), offset.data);
	return {
		items: page?.items ?? [],
		hasMore: page?.hasMore ?? false,
		online: page !== null,
		offset: offset.data
	};
};
