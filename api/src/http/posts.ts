/**
 * @file posts.ts
 * @brief Thin public and administrator post endpoint adapters.
 */
import { z } from 'zod';
import { createPost, deletePost, getPublishedPost, listPublishedPosts, PostError, updatePost } from '../posts/post-service.js';
import { normalizeSlug } from '../posts/publishing.js';
import { flattenIssues } from '../markdown/schema.js';
import { renderMarkdown } from '../markdown/render.js';
import type { ApiHandler } from './types.js';
import { requireUser } from './auth.js';
import { MEDIA_PREFIX, readBody, sendJson } from './response.js';

const pageSchema = z.object({
	limit: z.coerce.number().int().min(1).max(200).default(10),
	offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
	tag: z.string().min(1).max(60).optional(),
	search: z.string().trim().max(200).optional()
});
const previewSchema = z.object({ markdown: z.string().max(200_000) });

/**
 * @brief Lists visible posts using validated page and search options.
 * @param req Incoming request.
 * @param res Response stream.
 * @param deps Repositories.
 * @param url Parsed query.
 * @return Nothing.
 */
export const handleListPosts: ApiHandler = async (_req, res, deps, url) => {
	const parsed = pageSchema.safeParse(Object.fromEntries(url.searchParams));
	if (!parsed.success) {
		sendJson(res, 400, { error: 'validation', issues: flattenIssues(parsed.error) }); return;
	}
	sendJson(res, 200, await listPublishedPosts(deps, parsed.data));
};

/**
 * @brief Returns a visible post while masking drafts.
 * @param req Incoming request.
 * @param res Response stream.
 * @param deps Repositories.
 * @param url Parsed URL.
 * @param slug Requested slug.
 * @return Nothing.
 */
export const handleGetPost: ApiHandler = async (_req, res, deps, _url, slug) => {
	const post = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)
		? await getPublishedPost(deps, normalizeSlug(slug)) : null;
	sendJson(res, post ? 200 : 404, post ?? { error: 'not_found' });
};

/**
 * @brief Adapts authenticated post commands and domain errors.
 * @param req Incoming request.
 * @param res Response stream.
 * @param deps Repositories.
 * @param url Parsed URL.
 * @param id Requested post id.
 * @return Nothing.
 */
export const handleWritePost: ApiHandler = async (req, res, deps, _url, id) => {
	const user = await requireUser(req, res, deps);
	if (!user) { return; }
	if (id && !z.uuid().safeParse(id).success) { sendJson(res, 404, { error: 'not_found' }); return; }
	if (req.method === 'DELETE') {
		if (!await deletePost(deps, id)) { sendJson(res, 404, { error: 'not_found' }); return; }
		res.writeHead(204); res.end(); return;
	}
	const body = await readBody(req, res);
	if (!body) { return; }
	try {
		const item = req.method === 'POST' ? await createPost(deps, body.data, user.id) : await updatePost(deps, id, body.data);
		sendJson(res, req.method === 'POST' ? 201 : 200, item);
	} catch (error) {
		if (!(error instanceof PostError)) { throw error; }
		const status = error.code === 'not_found' ? 404 : error.code === 'conflict' ? 409 : 400;
		sendJson(res, status, { error: status === 400 ? 'validation' : error.code, message: error.message });
	}
};

/**
 * @brief Lists tags that actually have visible posts.
 * @param req Incoming request.
 * @param res Response stream.
 * @param deps Repositories.
 * @return Nothing.
 */
export const handleListTags: ApiHandler = async (_req, res, deps) => {
	const items = [];
	const now = new Date();
	for (const tag of await deps.tags.list()) {
		const page = await deps.posts.listPublished({ limit: 1, offset: 0, tag: tag.name, now });
		if (page.total > 0) { items.push({ name: tag.name, slug: tag.slug, count: page.total }); }
	}
	sendJson(res, 200, { items });
};

/**
 * @brief Returns the complete protected tag registry, including draft-only names.
 * @param req Incoming request.
 * @param res Response stream.
 * @param deps Repositories.
 * @return Nothing.
 */
export const handleAdminTags: ApiHandler = async (req, res, deps) => {
	if (!await requireUser(req, res, deps)) { return; }
	const items = [];
	const now = new Date();
	for (const tag of await deps.tags.list()) {
		const page = await deps.posts.listPublished({ limit: 1, offset: 0, tag: tag.name, now });
		items.push({ name: tag.name, slug: tag.slug, count: page.total });
	}
	sendJson(res, 200, { items });
};

/**
 * @brief Serves the protected ledger or one editable post.
 * @param req Incoming request.
 * @param res Response stream.
 * @param deps Repositories.
 * @param url Parsed URL.
 * @param id Optional post id.
 * @return Nothing.
 */
export const handleAdminPosts: ApiHandler = async (req, res, deps, _url, id) => {
	if (!await requireUser(req, res, deps)) { return; }
	if (id && !z.uuid().safeParse(id).success) { sendJson(res, 404, { error: 'not_found' }); return; }
	const rows = id ? [await deps.posts.findById(id)] : await deps.posts.listAll();
	const items = [];
	for (const row of rows) {
		if (!row) { sendJson(res, 404, { error: 'not_found' }); return; }
		const author = row.authorId ? await deps.users.findById(row.authorId) : null;
		items.push({
			id: row.id, slug: row.slug, title: row.title, description: row.description, status: row.status,
			tags: await deps.tags.getPostTagNames(row.id), authorName: author?.name ?? null,
			publishedAt: row.publishedAt?.toISOString() ?? null, publishAt: row.publishAt?.toISOString() ?? null,
			updatedAt: row.updatedAt.toISOString(),
			...(id ? { contentMarkdown: row.contentMarkdown, contentHtml: row.contentHtml, coverImage: row.coverImage } : {})
		});
	}
	sendJson(res, 200, id ? items[0] : { items, total: items.length });
};

/**
 * @brief Renders sanitized administrator Markdown previews.
 * @param req Incoming request.
 * @param res Response stream.
 * @param deps Repositories.
 * @return Nothing.
 */
export const handleRenderPreview: ApiHandler = async (req, res, deps) => {
	if (!await requireUser(req, res, deps)) { return; }
	const body = await readBody(req, res);
	if (!body) { return; }
	const parsed = previewSchema.safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation', issues: flattenIssues(parsed.error) }); return; }
	sendJson(res, 200, { html: (await renderMarkdown(parsed.data.markdown, { mediaPrefix: MEDIA_PREFIX })).html });
};
