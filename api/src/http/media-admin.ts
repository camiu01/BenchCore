/**
 * @file media-admin.ts
 * @brief Protected image usage inspection and confirmed storage deletion.
 */
import { z } from 'zod';
import { mediaRecord, sanitizeKey } from '../media/storage.js';
import { imageUsage, deleteManagedImage } from '../media/deletion-service.js';
import { requireUser } from './auth.js';
import { readBody, sendJson } from './response.js';
import type { ApiHandler } from './types.js';

const deletionSchema = z.object({ version: z.string().regex(/^[a-f0-9]{64}$/) });
const inspectionSchema = z.object({ details: z.literal('1').optional() });

/**
 * @brief Lists affected posts or deletes confirmed image references and storage.
 * @param req Request.
 * @param res Response.
 * @param deps Repositories and storage.
 * @param url URL.
 * @param key Media key.
 * @return Completion.
 */
export const handleAdminMedia: ApiHandler = async (req, res, deps, url, key) => {
	if (!await requireUser(req, res, deps)) return;
	if (!sanitizeKey(key)) { sendJson(res, 404, { error: 'not_found' }); return; }
	if (req.method === 'GET') {
		const query = inspectionSchema.safeParse(Object.fromEntries(url.searchParams));
		if (!query.success) { sendJson(res, 400, { error: 'validation' }); return; }
		if (query.data.details) {
			const record = await deps.media.describe?.(key);
			const parsed = mediaRecord.safeParse(record);
			const item = parsed.success && parsed.data.key === key ? parsed.data : null;
			sendJson(res, item ? 200 : 404, item ?? { error: 'not_found' }, { 'cache-control': 'private, no-store' });
			return;
		}
		const usage = await imageUsage(deps.posts, key);
		sendJson(res, 200, {
			uses: usage.rows.map(({ id, slug, title }) => ({ id, slug, title })),
			version: usage.version
		});
		return;
	}
	const body = await readBody(req, res);
	if (!body) return;
	const parsed = deletionSchema.safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
	const result = await deleteManagedImage(deps.posts, deps.media, key, parsed.data.version);
	if (result === 'conflict') { sendJson(res, 409, { error: 'usage_changed' }); return; }
	if (result === 'storage_failed') {
		sendJson(res, 502, { error: 'storage_failed', message: 'Saved references removed, but storage deletion failed. Retry.' });
		return;
	}
	res.writeHead(204); res.end();
};
