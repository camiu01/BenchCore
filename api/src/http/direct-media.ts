/**
 * @file direct-media.ts
 * @brief Administrator-only bounded direct-upload initiation and completion.
 */
import { z } from 'zod';
import { MAX_MEDIA_BYTES } from '../media/storage.js';
import { requireUser } from './auth.js';
import { readBody, sendJson, MEDIA_PREFIX } from './response.js';
import { apiMessage } from '../i18n/index.js';
import type { ApiHandler } from './types.js';

const prepareSchema = z.object({ filename: z.string().min(1).max(200),
	mime: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
	sizeBytes: z.number().int().positive().max(MAX_MEDIA_BYTES) }).strict();
const completeSchema = z.object({ ticket: z.string().min(1).max(4096) }).strict();

/**
 * @brief Signs a bounded PUT only after administrator and exact-Origin checks.
 * @param req Request. @param res Response. @param deps Dependencies.
 * @return Nothing.
 */
export const handlePrepareUpload: ApiHandler = async (req, res, deps) => {
	const user = await requireUser(req, res, deps);
	if (!user) { return; }
	if (!deps.media.direct) { sendJson(res, 404, { error: 'not_found' }); return; }
	const body = await readBody(req, res, 16 * 1024);
	if (!body) { return; }
	const parsed = prepareSchema.safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
	try { sendJson(res, 200, await deps.media.direct.prepare(parsed.data, user.id)); }
	catch { sendJson(res, 503, { error: 'internal', message: apiMessage(req, 'upload.unavailable') }); }
};

/**
 * @brief Publishes metadata only after validating owner-bound upload completion.
 * @param req Request. @param res Response. @param deps Dependencies.
 * @return Nothing.
 */
export const handleCompleteUpload: ApiHandler = async (req, res, deps) => {
	const user = await requireUser(req, res, deps);
	if (!user) { return; }
	if (!deps.media.direct) { sendJson(res, 404, { error: 'not_found' }); return; }
	const body = await readBody(req, res, 16 * 1024);
	if (!body) { return; }
	const parsed = completeSchema.safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
	try {
		const record = await deps.media.direct.complete(parsed.data.ticket, user.id);
		sendJson(res, 201, { ...record, url: `${MEDIA_PREFIX}/${record.key}` });
	} catch { sendJson(res, 400, { error: 'validation', message: apiMessage(req, 'upload.rejected') }); }
};
