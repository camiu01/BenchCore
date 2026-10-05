/**
 * @file media.ts
 * @brief Authenticated media mutation and immutable public reads.
 */
import { z } from 'zod';
import type { ServerResponse } from 'node:http';
import { flattenIssues } from '../markdown/schema.js';
import { sanitizeKey } from '../media/storage.js';
import { imageUsage } from '../media/deletion-service.js';
import type { ApiDeps, ApiHandler } from './types.js';
import { getSessionUser, requireUser } from './auth.js';
import { canReadPost, READER_CACHE_HEADERS } from '../posts/audience.js';
import { isReaderMedia } from '../media/read-access.js';
import { MEDIA_BODY_LIMIT, MEDIA_PREFIX, readBody, sendJson } from './response.js';

const uploadSchema = z.object({
	filename: z.string().min(1).max(200),
	mime: z.string().min(1).max(100),
	contentBase64: z.string().min(1).max(7_500_000)
		.regex(/^[A-Za-z0-9+/]*={0,2}$/)
		.refine((value) => value.length % 4 === 0, 'invalid base64 length')
});

/**
 * @brief Validates and saves an administrator upload.
 * @param req Incoming request.
 * @param res Response stream.
 * @param deps Storage and repositories.
 * @return Nothing.
 */
export const handleUploadMedia: ApiHandler = async (req, res, deps) => {
	if (!await requireUser(req, res, deps)) { return; }
	const body = await readBody(req, res, MEDIA_BODY_LIMIT);
	if (!body) { return; }
	const parsed = uploadSchema.safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation', issues: flattenIssues(parsed.error) }); return; }
	try {
		const record = await deps.media.save(Buffer.from(parsed.data.contentBase64, 'base64'), parsed.data.filename, parsed.data.mime);
		sendJson(res, 201, { ...record, url: `${MEDIA_PREFIX}/${record.key}` });
	} catch {
		sendJson(res, 400, { error: 'validation', message: 'unsupported media or upload size' });
	}
};

/**
 * @brief Loads safe media keys or deletes them after administrator authorization.
 * @param req Incoming request.
 * @param res Response stream.
 * @param deps Storage and repositories.
 * @param url Parsed URL.
 * @param key Requested storage key.
 * @return Nothing.
 */
export const handleMedia: ApiHandler = async (req, res, deps, _url, key) => {
	if (req.method === 'DELETE' && !await requireUser(req, res, deps)) { return; }
	if (!sanitizeKey(key)) { sendJson(res, 404, { error: 'not_found' }); return; }
	if (req.method === 'DELETE') {
		if ((await imageUsage(deps.posts, key)).rows.length > 0) {
			sendJson(res, 409, { error: 'image_in_use', message: 'Confirm deletion through the editor.' });
			return;
		}
		if (!await deps.media.remove(key)) { sendJson(res, 404, { error: 'not_found' }); return; }
		res.writeHead(204); res.end(); return;
	}
	const restricted = await isReaderMedia(deps.posts, key);
	if (restricted && !canReadPost('readers', (await getSessionUser(req, deps))?.role ?? null)) {
		sendJson(res, 404, { error: 'not_found' }, READER_CACHE_HEADERS); return;
	}
	res.setHeader('vary', 'Cookie');
	await sendMedia(res, deps, key);
};

/**
 * @brief Streams authorized bytes or returns a short-lived storage read redirect.
 * @param res Response stream.
 * @param deps Configured storage.
 * @param key Authorized managed key.
 * @return Completion.
 */
async function sendMedia(res: ServerResponse, deps: ApiDeps, key: string): Promise<void> {
	if (deps.media.readUrl) {
		const location = await deps.media.readUrl(key);
		if (!location) { sendJson(res, 404, { error: 'not_found' }); return; }
		res.writeHead(307, { location, 'cache-control': 'no-store' }); res.end(); return;
	}
	const file = await deps.media.load(key);
	if (!file) { sendJson(res, 404, { error: 'not_found' }); return; }
	res.writeHead(200, {
		'content-type': file.mime, 'content-length': file.data.length,
		'cache-control': 'private, no-store'
	});
	res.end(file.data);
}
