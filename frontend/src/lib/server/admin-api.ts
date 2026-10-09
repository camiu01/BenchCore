/**
 * @file admin-api.ts
 * @brief Validated, outage-tolerant admin API client with trusted mutation origins.
 */
import { z } from 'zod';
import { apiBase, tagSchema } from '../api.js';
import { mutationOrigin } from '../site.js';
import { payloadFromValues, type EditorValues } from './editor-values.js';
import { serverT } from './server-t.js';
import { apiFetch } from './transport.js';
export {
	blankValues,
	valuesFromForm,
	withUploadedImage,
	type EditorValues
} from './editor-values.js';

const statusSchema = z.enum(['draft', 'published', 'archived']);
const rowSchema = z.object({
	id: z.string().uuid(),
	slug: z.string(),
	title: z.string(),
	status: statusSchema,
	tags: z.array(z.string()),
	updatedAt: z.iso.datetime({ offset: true })
});
const detailSchema = z.object({
	id: z.string().uuid(),
	title: z.string(),
	slug: z.string(),
	description: z.string(),
	status: statusSchema,
	audience: z.enum(['public', 'readers']).default('public'),
	tags: z.array(z.string()),
	publishedAt: z.iso.datetime({ offset: true }).nullable(),
	publishAt: z.iso.datetime({ offset: true }).nullable(),
	coverImage: z.string().nullable(),
	contentMarkdown: z.string()
});
const listSchema = z.object({
	items: z.array(rowSchema),
	total: z.number().int().nonnegative(),
	counts: z.object({
		all: z.number().int().nonnegative(),
		draft: z.number().int().nonnegative(),
		published: z.number().int().nonnegative(),
		archived: z.number().int().nonnegative()
	})
});
const postSuggestionsSchema = z.object({
	items: z
		.array(
			z.object({
				id: z.uuid(),
				slug: z.string(),
				title: z.string(),
				tags: z.array(z.string().max(60)).max(20).default([])
			})
		)
		.max(200)
});
const errorSchema = z.object({ message: z.string() });
const previewSchema = z.object({ html: z.string() });
const uploadSchema = z.object({
	url: z.string().regex(/^\/api\/media\/[A-Za-z0-9]{32}\.(png|jpg|jpeg|webp|gif)$/)
});
const tagsSchema = z.object({
	items: z.array(
		tagSchema.extend({
			id: z.uuid(),
			count: z.number().int().nonnegative()
		})
	)
});
export const commentStatusSchema = z.enum(['pending', 'approved', 'rejected']);
const commentsSchema = z.object({
	hasMore: z.boolean(),
	items: z.array(
		z.object({
			id: z.uuid(),
			postId: z.uuid(),
			authorName: z.string(),
			content: z.string(),
			status: commentStatusSchema,
			createdAt: z.iso.datetime({ offset: true }),
			post: z.object({ slug: z.string(), title: z.string() }).nullable()
		})
	)
});
export type AdminPostRow = z.infer<typeof rowSchema>;

/**
 * @brief Sends an authenticated API request, failing closed on network errors.
 * @param cookie The session Cookie header.
 * @param query Bounded page and optional ledger filters.
 * @param method The HTTP method.
 * @param path The fixed API path.
 * @param body The optional JSON payload.
 * @return The upstream status and untrusted JSON, or a synthetic outage status.
 */
async function authedJson(
	cookie: string | null,
	method: string,
	path: string,
	body?: unknown
): Promise<{ status: number; data: unknown }> {
	const headers: Record<string, string> = { 'content-type': 'application/json' };
	if (cookie !== null) {
		headers['cookie'] = cookie;
	}
	if (method !== 'GET') {
		headers['origin'] = mutationOrigin();
	}
	try {
		const response = await apiFetch(`${apiBase()}${path}`, {
			method,
			headers,
			body: body === undefined ? null : JSON.stringify(body),
			signal: AbortSignal.timeout(10000)
		});
		const data: unknown = response.status === 204 ? null : await response.json().catch(() => null);
		return { status: response.status, data };
	} catch {
		return { status: 503, data: { message: serverT('admin.api.unreachable') } };
	}
}

/**
 * @brief Extracts a validated upstream error message.
 * @param data The untrusted API response.
 * @param fallback The generic failure message.
 * @return A safe textual error message.
 */
function messageFrom(data: unknown, fallback: string): string {
	const parsed = errorSchema.safeParse(data);
	return parsed.success ? parsed.data.message : fallback;
}

/**
 * @brief Loads the validated admin ledger.
 * @param cookie The session Cookie header.
 * @return The post list or null on invalid/unreachable responses.
 */
export async function adminListPosts(cookie: string | null, query = new URLSearchParams()) {
	const suffix = query.size ? `?${query}` : '';
	const { status, data } = await authedJson(cookie, 'GET', `/api/admin/posts${suffix}`);
	const parsed = listSchema.safeParse(data);
	return status === 200 && parsed.success ? parsed.data : null;
}

/**
 * @brief Loads a bounded lightweight post index for wikilink completion.
 * @param cookie Session Cookie header.
 * @return Protected post suggestions or null during an outage.
 */
export async function adminListPostSuggestions(cookie: string | null) {
	const { status, data } = await authedJson(cookie, 'GET', '/api/admin/posts/suggestions');
	const parsed = postSuggestionsSchema.safeParse(data);
	return status === 200 && parsed.success ? parsed.data.items : null;
}

/**
 * @brief Loads all tag names without exposing private tags through the public API.
 * @param cookie Session Cookie header.
 * @return Protected registry or null during an outage.
 */
export async function adminListTags(cookie: string | null) {
	const { status, data } = await authedJson(cookie, 'GET', '/api/admin/tags');
	const parsed = tagsSchema.safeParse(data);
	return status === 200 && parsed.success ? parsed.data : null;
}

/**
 * @brief Changes a tag color.
 * @param cookie Session Cookie header.
 * @param id Tag id.
 * @param color Validated HEX color.
 * @return Success or a safe failure.
 */
export async function adminUpdateTagColor(cookie: string | null, id: string, color: string) {
	const { status, data } = await authedJson(
		cookie,
		'PATCH',
		`/api/admin/tags/${encodeURIComponent(id)}`,
		{ color }
	);
	return status === 200
		? { ok: true as const }
		: {
				ok: false as const,
				error: messageFrom(data, serverT('admin.error.colorUpdateFailed', { status }))
			};
}

/**
 * @brief Deletes a tag and its post associations.
 * @param cookie Session Cookie header.
 * @param id Tag id.
 * @return Success or a safe failure.
 */
export async function adminDeleteTag(cookie: string | null, id: string) {
	const { status, data } = await authedJson(
		cookie,
		'DELETE',
		`/api/admin/tags/${encodeURIComponent(id)}`
	);
	return status === 204
		? { ok: true as const }
		: {
				ok: false as const,
				error: messageFrom(data, serverT('admin.error.tagDeleteFailed', { status }))
			};
}

/**
 * @brief Lists comments for moderation.
 * @param cookie Session Cookie header.
 * @param status Moderation filter.
 * @param offset Validated row offset, default zero.
 * @return Comment registry or null.
 */
export async function adminListComments(cookie: string | null, status: string, offset = 0) {
	const query = new URLSearchParams({ offset: String(offset) });
	if (['pending', 'approved', 'rejected'].includes(status)) {
		query.set('status', status);
	}
	const { status: code, data } = await authedJson(cookie, 'GET', `/api/admin/comments?${query}`);
	const parsed = commentsSchema.safeParse(data);
	return code === 200 && parsed.success ? parsed.data : null;
}

/**
 * @brief Changes comment moderation state.
 * @param cookie Session Cookie header.
 * @param id Comment id.
 * @param status Desired state.
 * @return Success or failure.
 */
export async function adminModerateComment(
	cookie: string | null,
	id: string,
	status: z.infer<typeof commentStatusSchema>
) {
	const result = await authedJson(
		cookie,
		'PATCH',
		`/api/admin/comments/${encodeURIComponent(id)}`,
		{ status }
	);
	return result.status === 200
		? { ok: true as const }
		: {
				ok: false as const,
				error: messageFrom(
					result.data,
					serverT('admin.error.moderationFailed', { status: result.status })
				)
			};
}

/**
 * @brief Deletes a comment.
 * @param cookie Session Cookie header.
 * @param id Comment id.
 * @return Success or failure.
 */
export async function adminDeleteComment(cookie: string | null, id: string) {
	const result = await authedJson(
		cookie,
		'DELETE',
		`/api/admin/comments/${encodeURIComponent(id)}`
	);
	return result.status === 204
		? { ok: true as const }
		: {
				ok: false as const,
				error: messageFrom(
					result.data,
					serverT('admin.error.commentDeleteFailed', { status: result.status })
				)
			};
}

/**
 * @brief Loads a validated editor post.
 * @param cookie The session Cookie header.
 * @param id The post ID.
 * @return The post detail or null.
 */
export async function adminGetPost(cookie: string | null, id: string) {
	const { status, data } = await authedJson(
		cookie,
		'GET',
		`/api/admin/posts/${encodeURIComponent(id)}`
	);
	const parsed = detailSchema.safeParse(data);
	return status === 200 && parsed.success ? parsed.data : null;
}

/**
 * @brief Saves a validated post payload.
 * @param cookie The session Cookie header.
 * @param id The existing post ID, or null to create.
 * @param values The submitted values.
 * @return Success or a textual validation/API failure.
 */
export async function adminSavePost(
	cookie: string | null,
	id: string | null,
	values: EditorValues
): Promise<{ ok: true } | { ok: false; error: string }> {
	let payload: ReturnType<typeof payloadFromValues>;
	try {
		payload = payloadFromValues(values);
	} catch {
		return { ok: false, error: serverT('admin.error.invalidFields') };
	}
	const path = id === null ? '/api/posts' : `/api/posts/${encodeURIComponent(id)}`;
	const { status, data } = await authedJson(cookie, id === null ? 'POST' : 'PUT', path, payload);
	if (status === (id === null ? 201 : 200)) {
		return { ok: true };
	}
	return { ok: false, error: messageFrom(data, serverT('admin.error.saveFailed', { status })) };
}

/**
 * @brief Deletes a post through the guarded API.
 * @param cookie The session Cookie header.
 * @param id The post ID.
 * @return Whether deletion succeeded.
 */
export async function adminDeletePost(cookie: string | null, id: string): Promise<boolean> {
	const { status } = await authedJson(cookie, 'DELETE', `/api/posts/${encodeURIComponent(id)}`);
	return status === 204;
}

/**
 * @brief Loads a validated API-sanitized Markdown preview.
 * @param cookie The session Cookie header.
 * @param markdown The source Markdown.
 * @return The preview HTML or null.
 */
export async function adminRenderPreview(
	cookie: string | null,
	markdown: string
): Promise<string | null> {
	const { status, data } = await authedJson(cookie, 'POST', '/api/render', { markdown });
	const parsed = previewSchema.safeParse(data);
	return status === 200 && parsed.success ? parsed.data.html : null;
}

/**
 * @brief Validates and uploads an image without buffering oversized files.
 * @param cookie The session Cookie header.
 * @param file The submitted file.
 * @return The same-origin media URL or a failure message.
 */
export async function adminUploadMedia(
	cookie: string | null,
	file: File
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
	if (
		file.size === 0 ||
		file.size > 5 * 1024 * 1024 ||
		!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)
	) {
		return { ok: false, error: serverT('admin.error.invalidImage') };
	}
	const buffer = Buffer.from(await file.arrayBuffer());
	const { status, data } = await authedJson(cookie, 'POST', '/api/media', {
		filename: file.name,
		mime: file.type,
		contentBase64: buffer.toString('base64')
	});
	const parsed = uploadSchema.safeParse(data);
	if (status === 201 && parsed.success) {
		return { ok: true, url: parsed.data.url };
	}
	return { ok: false, error: messageFrom(data, serverT('admin.error.uploadFailed', { status })) };
}
