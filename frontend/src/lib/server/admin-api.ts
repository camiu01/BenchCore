/**
 * @file admin-api.ts
 * @brief Validated, outage-tolerant admin API client with trusted mutation origins.
 */
import { z } from 'zod';
import { apiBase } from '../api.js';
import { mutationOrigin } from '../site.js';
import { payloadFromValues, type EditorValues } from './editor-values.js';
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
	tags: z.array(z.string()),
	publishedAt: z.iso.datetime({ offset: true }).nullable(),
	publishAt: z.iso.datetime({ offset: true }).nullable(),
	coverImage: z.string().nullable(),
	contentMarkdown: z.string()
});
const listSchema = z.object({ items: z.array(rowSchema), total: z.number().int().nonnegative() });
const errorSchema = z.object({ message: z.string() });
const previewSchema = z.object({ html: z.string() });
const uploadSchema = z.object({
	url: z.string().regex(/^\/api\/media\/[A-Za-z0-9]{32}\.(png|jpg|jpeg|webp|gif)$/)
});
const tagsSchema = z.object({
	items: z.array(
		z.object({ name: z.string(), slug: z.string(), count: z.number().int().nonnegative() })
	)
});
export type AdminPostRow = z.infer<typeof rowSchema>;

/**
 * @brief Sends an authenticated API request, failing closed on network errors.
 * @param cookie The session Cookie header.
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
		return { status: 503, data: { message: 'API unreachable. Please retry.' } };
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
export async function adminListPosts(cookie: string | null) {
	const { status, data } = await authedJson(cookie, 'GET', '/api/admin/posts');
	const parsed = listSchema.safeParse(data);
	return status === 200 && parsed.success ? parsed.data : null;
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
		return { ok: false, error: 'Invalid fields. Dates must be ISO timestamps with a timezone.' };
	}
	const path = id === null ? '/api/posts' : `/api/posts/${encodeURIComponent(id)}`;
	const { status, data } = await authedJson(cookie, id === null ? 'POST' : 'PUT', path, payload);
	if (status === (id === null ? 201 : 200)) {
		return { ok: true };
	}
	return { ok: false, error: messageFrom(data, `Save failed (${status}).`) };
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
		return { ok: false, error: 'Select a png/jpg/webp/gif image up to 5 MiB.' };
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
	return { ok: false, error: messageFrom(data, `Upload failed (${status}).`) };
}
