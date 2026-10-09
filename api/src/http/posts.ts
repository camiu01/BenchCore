/**
 * @file posts.ts
 * @brief Thin public and administrator post endpoint adapters.
 */
import { z } from 'zod';
import { createPost, deletePost, getPublishedPost, listPublishedPosts, PostError, updatePost } from '../posts/post-service.js';
import { normalizeSlug } from '../posts/publishing.js';
import { flattenIssues } from '../markdown/schema.js';
import { renderMarkdown } from '../markdown/render.js';
import { apiMessage } from '../i18n/index.js';
import type { ApiHandler } from './types.js';
import { getSessionUser, requireUser } from './auth.js';
import { READER_CACHE_HEADERS } from '../posts/audience.js';
import { MEDIA_PREFIX, readBody, sendJson } from './response.js';
import { adminPageSchema } from '../posts/admin-query.js';
import { parsePublishedQuery } from '../posts/list-query.js';

const previewSchema = z.object({ markdown: z.string().max(200_000) });
const tagColorSchema = z.object({
	color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).transform((color) => color.toUpperCase())
}).strict();

/**
 * @brief Lists visible posts using validated page and search options.
 * @param req Incoming request.
 * @param res Response stream.
 * @param deps Repositories.
 * @param url Parsed query.
 * @return Nothing.
 */
export const handleListPosts: ApiHandler = async (req, res, deps, url) => {
	const parsed = parsePublishedQuery(url.searchParams);
	if (!parsed.success) {
		sendJson(res, 400, { error: 'validation', issues: flattenIssues(parsed.error) }); return;
	}
	const user = await getSessionUser(req, deps);
	sendJson(res, 200, await listPublishedPosts({ ...deps, viewerRole: user?.role ?? null }, parsed.data), READER_CACHE_HEADERS);
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
export const handleGetPost: ApiHandler = async (req, res, deps, _url, slug) => {
	const user = await getSessionUser(req, deps);
	const post = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)
		? await getPublishedPost({ ...deps, viewerRole: user?.role ?? null }, normalizeSlug(slug)) : null;
	sendJson(res, post ? 200 : 404, post ?? { error: 'not_found' }, READER_CACHE_HEADERS);
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
		const writeDeps = { ...deps, viewerRole: user.role };
		const item = req.method === 'POST' ? await createPost(writeDeps, body.data, user.id) : await updatePost(writeDeps, id, body.data);
		sendJson(res, req.method === 'POST' ? 201 : 200, item);
	} catch (error) {
		if (!(error instanceof PostError)) { throw error; }
		const status = error.code === 'not_found' ? 404 : error.code === 'conflict' ? 409 : 400;
		sendJson(res, status, { error: status === 400 ? 'validation' : error.code, message: error.localized ? apiMessage(req, error.localized.key, error.localized.params) : error.message });
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
	const items = (await deps.posts.listTagCounts(new Date()))
		.filter((tag) => tag.count > 0)
		.map(({ name, slug, color, count }) => ({ name, slug, color, count }));
	sendJson(res, 200, { items });
};

/**
 * @brief Returns the complete protected tag registry, including draft-only names.
 * @param req Incoming request.
 * @param res Response stream.
 * @param deps Repositories.
 * @return Nothing.
 */
export const handleAdminTags: ApiHandler = async (req, res, deps, _url, id) => {
	if (!await requireUser(req, res, deps)) { return; }
	if (id) {
		if (!z.uuid().safeParse(id).success) { sendJson(res, 404, { error: 'not_found' }); return; }
		if (req.method === 'DELETE') {
			const removed = await deps.tags.remove(id);
			if (!removed) { sendJson(res, 404, { error: 'not_found' }); return; }
			res.writeHead(204); res.end(); return;
		}
		const body = await readBody(req, res);
		if (!body) { return; }
		const parsed = tagColorSchema.safeParse(body.data);
		if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
		const updated = await deps.tags.updateColor(id, parsed.data.color);
		sendJson(res, updated ? 200 : 404, updated ?? { error: 'not_found' });
		return;
	}
	const items = await deps.posts.listTagCounts(new Date());
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
export const handleAdminPosts: ApiHandler = async (req, res, deps, url, id) => {
	if (!await requireUser(req, res, deps)) { return; }
	if (id && !z.uuid().safeParse(id).success) { sendJson(res, 404, { error: 'not_found' }); return; }
	const query = adminPageSchema.safeParse(Object.fromEntries(url.searchParams));
	if (!id && !query.success) { sendJson(res, 400, { error: 'validation' }); return; }
	const page = !id && query.success ? await deps.posts.listAdmin(query.data) : null;
	const rows = id ? [await deps.posts.findById(id)] : page?.items ?? [];
	const pageTags = new Map(page?.items.map((row) => [row.id, row.tags]));
	const authors = new Map<string, string | null>();
	const items = [];
	for (const row of rows) {
		if (!row) { sendJson(res, 404, { error: 'not_found' }); return; }
		if (row.authorId && !authors.has(row.authorId)) {
			authors.set(row.authorId, (await deps.users.findById(row.authorId))?.name ?? null);
		}
		items.push({
			id: row.id, slug: row.slug, title: row.title, description: row.description, status: row.status,
			audience: row.audience,
			tags: pageTags.get(row.id) ?? await deps.tags.getPostTagNames(row.id),
			authorName: row.authorId ? authors.get(row.authorId) ?? null : null,
			publishedAt: row.publishedAt?.toISOString() ?? null, publishAt: row.publishAt?.toISOString() ?? null,
			updatedAt: row.updatedAt.toISOString(),
			...(id ? { contentMarkdown: row.contentMarkdown, contentHtml: row.contentHtml, coverImage: row.coverImage } : {})
		});
	}
	sendJson(res, 200, id ? items[0] : { items, total: page?.total ?? 0, counts: page?.counts });
};

/**
 * @brief Serves a bounded lightweight post index for wikilink completion.
 * @param req Incoming request.
 * @param res Response stream.
 * @param deps Repositories.
 * @return Nothing.
 */
export const handleAdminPostSuggestions: ApiHandler = async (req, res, deps) => {
	if (!await requireUser(req, res, deps)) { return; }
	sendJson(res, 200, { items: await deps.posts.listSuggestions(200) });
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
