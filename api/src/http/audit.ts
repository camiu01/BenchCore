/**
 * @file audit.ts
 * @brief Administrator-only bounded security history and confirmed bulk post deletion.
 */
import { z } from 'zod';
import { requireUser } from './auth.js';
import { readBody, sendJson } from './response.js';
import type { ApiHandler } from './types.js';

/** @brief Reads identifier-only security events. @param req Request. @param res Response. @param deps Dependencies. @param url Query. @return Completion. */
export const handleAudit: ApiHandler = async (req, res, deps, url) => {
	if (!await requireUser(req, res, deps)) { return; }
	const offset = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(100_000))
		.safeParse(url.searchParams.get('offset') ?? '0');
	if (!offset.success) { sendJson(res, 400, { error: 'validation' }); return; }
	const rows = await deps.security.listEvents(offset.data);
	sendJson(res, 200, { items: rows.slice(0, 50).map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
		hasMore: rows.length > 50 });
};

/** @brief Deletes an explicitly confirmed bounded selection with an atomic audit. @param req Request. @param res Response. @param deps Dependencies. @return Completion. */
export const handleBulkDeletePosts: ApiHandler = async (req, res, deps) => {
	const actor = await requireUser(req, res, deps);
	if (!actor) { return; }
	const body = await readBody(req, res);
	if (!body) { return; }
	const parsed = z.object({ ids: z.array(z.uuid()).min(1).max(100), confirmation: z.literal('DELETE') }).strict().safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
	const count = await deps.security.deletePosts(actor.id, [...new Set(parsed.data.ids)]);
	sendJson(res, 200, { count });
};
