/**
 * @file engagement.ts
 * @brief Public comment/like and administrator moderation HTTP adapters.
 */
import { z } from 'zod';
import { createSessionToken, hashToken, parseCookies, tokenCookieHeader } from '../auth/session.js';
import { commentSchema, createComment, findPublicPost, moderationSchema, publicComment } from '../posts/engagement-service.js';
import type { ApiHandler } from './types.js';
import { getSessionUser, requireUser } from './auth.js';
import { canReadPost, READER_CACHE_HEADERS } from '../posts/audience.js';
import { readBody, sendJson } from './response.js';

const LIKE_COOKIE = 'like_voter';
const VOTER_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const offsetSchema = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(2_147_483_647));

/**
 * @brief Lists approved comments or creates a pending one for a public post.
 * @param req Request. @param res Response. @param deps Dependencies. @param url URL. @param slug Post slug.
 * @return Completion.
 */
export const handleComments: ApiHandler = async (req, res, deps, url, slug) => {
	const post = await findPublicPost(deps.posts, slug);
	if (!post) { sendJson(res, 404, { error: 'not_found' }); return; }
	res.setHeader('cache-control', READER_CACHE_HEADERS['cache-control']);
	res.setHeader('vary', 'Cookie');
	if (!canReadPost(post.audience, (await getSessionUser(req, deps))?.role ?? null)) {
		sendJson(res, 401, { error: 'unauthorized' }); return;
	}
	if (req.method === 'GET') {
		const offset = offsetSchema.safeParse(url.searchParams.get('offset') ?? '0');
		if (!offset.success) { sendJson(res, 400, { error: 'validation' }); return; }
		const rows = await deps.comments.listApproved(post.id, offset.data);
		const items = rows.slice(0, 100).map(publicComment);
		sendJson(res, 200, { items, hasMore: rows.length > 100 }); return;
	}
	const body = await readBody(req, res);
	if (!body) { return; }
	const parsed = commentSchema.safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
	await createComment(deps.comments, post.id, parsed.data);
	sendJson(res, 202, { ok: true, message: 'Comment submitted for moderation' });
};

/**
 * @brief Reads or toggles an anonymous like on a public post.
 * @param req Request. @param res Response. @param deps Dependencies. @param url URL. @param slug Post slug.
 * @return Completion.
 */
export const handleLikes: ApiHandler = async (req, res, deps, _url, slug) => {
	const post = await findPublicPost(deps.posts, slug);
	if (!post) { sendJson(res, 404, { error: 'not_found' }); return; }
	res.setHeader('cache-control', READER_CACHE_HEADERS['cache-control']);
	res.setHeader('vary', 'Cookie');
	if (!canReadPost(post.audience, (await getSessionUser(req, deps))?.role ?? null)) {
		sendJson(res, 401, { error: 'unauthorized' }); return;
	}
	const existing = parseCookies(req.headers.cookie)[LIKE_COOKIE];
	const valid = existing && VOTER_PATTERN.test(existing) ? existing : null;
	if (req.method === 'GET') {
		const [count, liked] = await Promise.all([
			deps.likes.count(post.id),
			valid ? deps.likes.has(post.id, hashToken(valid)) : Promise.resolve(false)
		]);
		sendJson(res, 200, {
			count,
			liked
		});
		return;
	}
	const fresh = valid ? null : createSessionToken();
	const token = valid ?? fresh!.token;
	const liked = await deps.likes.toggle(post.id, fresh?.tokenHash ?? hashToken(token));
	sendJson(res, 200, { liked, count: await deps.likes.count(post.id) },
		valid ? undefined : {
			'set-cookie': tokenCookieHeader(LIKE_COOKIE, token, deps.cookieSecure, 31_536_000)
		});
};

/**
 * @brief Lists comments for moderation.
 * @param req Request. @param res Response. @param deps Dependencies. @param url Filter URL.
 * @return Completion.
 */
export const handleAdminComments: ApiHandler = async (req, res, deps, url) => {
	if (!await requireUser(req, res, deps)) { return; }
	const parsed = moderationSchema.shape.status.optional()
		.safeParse(url.searchParams.get('status') ?? undefined);
	const offset = offsetSchema.safeParse(url.searchParams.get('offset') ?? '0');
	if (!parsed.success || !offset.success) { sendJson(res, 400, { error: 'validation' }); return; }
	const rows = await deps.comments.listByStatus(parsed.data, offset.data);
	const items = await Promise.all(rows.slice(0, 100).map(async (row) => {
		const post = await deps.posts.findById(row.postId);
		return {
			...publicComment(row),
			postId: row.postId,
			status: row.status,
			post: post ? { slug: post.slug, title: post.title } : null
		};
	}));
	sendJson(res, 200, { items, hasMore: rows.length > 100 });
};

/**
 * @brief Changes or deletes one moderated comment.
 * @param req Request. @param res Response. @param deps Dependencies. @param url URL. @param id Comment id.
 * @return Completion.
 */
export const handleAdminComment: ApiHandler = async (req, res, deps, _url, id) => {
	if (!await requireUser(req, res, deps)) { return; }
	if (!z.uuid().safeParse(id).success) { sendJson(res, 404, { error: 'not_found' }); return; }
	if (req.method === 'DELETE') {
		const removed = await deps.comments.remove(id);
		if (!removed) { sendJson(res, 404, { error: 'not_found' }); return; }
		res.writeHead(204); res.end(); return;
	}
	const body = await readBody(req, res);
	if (!body) { return; }
	const parsed = moderationSchema.safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
	const updated = await deps.comments.setStatus(id, parsed.data.status);
	sendJson(res, updated ? 200 : 404, updated
		? { ...publicComment(updated), postId: updated.postId, status: updated.status }
		: { error: 'not_found' });
};
