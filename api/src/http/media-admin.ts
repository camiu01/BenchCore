/**
 * @file media-admin.ts
 * @brief Protected image usage inspection and confirmed storage deletion.
 */
import { z } from 'zod';
import { sanitizeKey } from '../media/storage.js';
import { imageUsage, deleteManagedImage } from '../media/deletion-service.js';
import { requireUser } from './auth.js';
import { readBody, sendJson } from './response.js';
import type { ApiHandler } from './types.js';

const deletionSchema = z.object({ version: z.string().regex(/^[a-f0-9]{64}$/) });

/**
 * @brief Lists affected posts or deletes confirmed image references and storage.
 * @param req Request.
 * @param res Response.
 * @param deps Repositories and storage.
 * @param url URL.
 * @param key Media key.
 * @return Completion.
 */
export const handleAdminMedia: ApiHandler = async (req, res, deps, _url, key) => {
	if (!await requireUser(req, res, deps)) return;
	if (!sanitizeKey(key)) { sendJson(res, 404, { error: 'not_found' }); return; }
	if (req.method === 'GET') {
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
