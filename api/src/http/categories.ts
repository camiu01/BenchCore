/**
 * @file categories.ts
 * @brief Public category counts and administrator-only assignment management.
 */
import { z } from 'zod';
import { requireUser } from './auth.js';
import { readBody, sendJson } from './response.js';
import type { ApiHandler } from './types.js';

const commandSchema = z.object({
	name: z.string().trim().min(1).max(80),
	replacement: z.string().trim().min(1).max(80).nullable()
}).strict();

/** @brief Lists only published category assignments. @param req Request. @param res Response. @param deps Repositories. @return Completion. */
export const handleCategories: ApiHandler = async (_req, res, deps) => {
	sendJson(res, 200, { items: await deps.posts.listCategories() });
};

/** @brief Lists, renames or clears categories without deleting posts. @param req Request. @param res Response. @param deps Repositories. @return Completion. */
export const handleAdminCategories: ApiHandler = async (req, res, deps) => {
	if (!await requireUser(req, res, deps)) { return; }
	if (req.method === 'GET') { sendJson(res, 200, { items: await deps.posts.listCategories(true) }); return; }
	const body = await readBody(req, res);
	if (!body) { return; }
	const parsed = commandSchema.safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
	sendJson(res, 200, { changed: await deps.posts.replaceCategory(parsed.data.name, parsed.data.replacement) });
};
