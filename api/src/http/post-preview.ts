/**
 * @file post-preview.ts
 * @brief Read-only post preview boundary, with validation and private responses.
 */
import { z } from 'zod';
import { getPublishedPreview } from '../posts/post-preview.js';
import { READER_CACHE_HEADERS } from '../posts/audience.js';
import { getSessionUser } from './auth.js';
import { sendJson } from './response.js';
import type { ApiHandler } from './types.js';

const slugSchema = z.string().max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i);

/** @brief Resolves the current viewer before projecting one published preview. @param req Request. @param res Response. @param deps Dependencies. @param url Parsed URL. @param slug Target slug. @return Completion. */
export const handlePostPreview: ApiHandler = async (req, res, deps, _url, slug) => {
	const parsed = slugSchema.safeParse(slug);
	const user = await getSessionUser(req, deps);
	const preview = parsed.success ? await getPublishedPreview({ ...deps, viewerRole: user?.role ?? null }, parsed.data) : null;
	sendJson(res, preview ? 200 : 404, preview ?? { error: 'not_found' }, READER_CACHE_HEADERS);
};
