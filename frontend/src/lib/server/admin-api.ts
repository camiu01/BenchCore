/**
 * Server-only admin client: forwards the browser session cookie to the API.
 * Every mutation goes through the session-guarded API, never touches the DB.
 */
import { apiBase } from '../api.js';

/**
 * @brief Editor form values echoed between actions and the page.
 */
export interface EditorValues {
	title: string;
	slug: string;
	description: string;
	status: string;
	tags: string;
	publishedAt: string;
	coverImage: string;
	content: string;
}

/**
 * @brief Empty editor defaults for new posts.
 * @returns The blank values.
 */
export function blankValues(): EditorValues {
	return {
		title: '',
		slug: '',
		description: '',
		status: 'draft',
		tags: '',
		publishedAt: '',
		coverImage: '',
		content: ''
	};
}

/**
 * @brief Reads editor values from submitted form data.
 * @param form The submitted form data.
 * @return The editor values.
 */
export function valuesFromForm(form: FormData): EditorValues {
	return {
		title: String(form.get('title') ?? ''),
		slug: String(form.get('slug') ?? ''),
		description: String(form.get('description') ?? ''),
		status: String(form.get('status') ?? 'draft'),
		tags: String(form.get('tags') ?? ''),
		publishedAt: String(form.get('published_at') ?? ''),
		coverImage: String(form.get('cover_image') ?? ''),
		content: String(form.get('content') ?? '')
	};
}

/**
 * @brief Splits a comma-separated tag string into names.
 * @param csv The raw tag input.
 * @return The trimmed tag names.
 */
function splitTags(csv: string): string[] {
	return csv
		.split(',')
		.map((tag) => tag.trim())
		.filter((tag) => tag !== '');
}

/**
 * @brief Builds the API payload from editor values.
 * @param values The editor values.
 * @return The API create/update payload.
 */
function payloadFromValues(values: EditorValues): Record<string, unknown> {
	const payload: Record<string, unknown> = {
		title: values.title,
		slug: values.slug,
		description: values.description,
		status: values.status,
		tags: splitTags(values.tags),
		contentMarkdown: values.content
	};
	if (values.publishedAt.trim() !== '') {
		payload['publishedAt'] = values.publishedAt.trim();
	}
	if (values.coverImage.trim() !== '') {
		payload['coverImage'] = values.coverImage.trim();
	}
	return payload;
}

/**
 * @brief Sends an authenticated JSON request to the API.
 * @param cookie The raw Cookie header to forward.
 * @param method The HTTP method.
 * @param path The API path.
 * @param body The optional JSON body.
 * @return The status plus parsed body when JSON.
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
	const init: { method: string; headers: Record<string, string>; body?: string } = {
		method,
		headers
	};
	if (body !== undefined) {
		init.body = JSON.stringify(body);
	}
	const response = await fetch(`${apiBase()}${path}`, init);
	let data: unknown;
	try {
		data = await response.json();
	} catch {
		data = null;
	}
	return { status: response.status, data };
}

/**
 * @brief An admin post row for the dashboard table.
 */
export interface AdminPostRow {
	id: string;
	slug: string;
	title: string;
	status: string;
	tags: string[];
	updatedAt: string;
}

/**
 * @brief Lists every post including drafts for the admin table.
 * @param cookie The raw Cookie header to forward.
 * @return The admin list or null when unreachable.
 */
export async function adminListPosts(
	cookie: string | null
): Promise<{ items: AdminPostRow[]; total: number } | null> {
	const { status, data } = await authedJson(cookie, 'GET', '/api/admin/posts');
	return status === 200 ? (data as { items: AdminPostRow[]; total: number }) : null;
}

/**
 * @brief Loads one post by id for the editor.
 * @param cookie The raw Cookie header to forward.
 * @param id The post id.
 * @return The post or null.
 */
export async function adminGetPost(
	cookie: string | null,
	id: string
): Promise<{
	id: string;
	title: string;
	slug: string;
	description: string;
	status: string;
	tags: string[];
	publishedAt: string | null;
	coverImage: string | null;
	contentMarkdown: string;
} | null> {
	const { status, data } = await authedJson(cookie, 'GET', `/api/admin/posts/${id}`);
	return status === 200 ? (data as never) : null;
}

/**
 * @brief Creates or updates a post through the API.
 * @param cookie The raw Cookie header to forward.
 * @param id The post id, or null to create.
 * @param values The editor values.
 * @return Success or the API error message.
 */
export async function adminSavePost(
	cookie: string | null,
	id: string | null,
	values: EditorValues
): Promise<{ ok: true } | { ok: false; error: string }> {
	const path = id === null ? '/api/posts' : `/api/posts/${id}`;
	const method = id === null ? 'POST' : 'PUT';
	const { status, data } = await authedJson(cookie, method, path, payloadFromValues(values));
	if ((method === 'POST' && status === 201) || (method === 'PUT' && status === 200)) {
		return { ok: true };
	}
	const message = (data as { message?: string } | null)?.message ?? `save failed (${status})`;
	return { ok: false, error: message };
}

/**
 * @brief Deletes a post through the API.
 * @param cookie The raw Cookie header to forward.
 * @param id The post id.
 * @return True on success.
 */
export async function adminDeletePost(cookie: string | null, id: string): Promise<boolean> {
	const { status } = await authedJson(cookie, 'DELETE', `/api/posts/${id}`);
	return status === 204;
}

/**
 * @brief Renders Markdown to a preview fragment through the API.
 * @param cookie The raw Cookie header to forward.
 * @param markdown The Markdown source.
 * @return The HTML fragment or null.
 */
export async function adminRenderPreview(
	cookie: string | null,
	markdown: string
): Promise<string | null> {
	const { status, data } = await authedJson(cookie, 'POST', '/api/render', { markdown });
	if (status !== 200) {
		return null;
	}
	return (data as { html?: string } | null)?.html ?? null;
}

/**
 * @brief Uploads an image file through the API.
 * @param cookie The raw Cookie header to forward.
 * @param file The uploaded file.
 * @return The media URL or an error message.
 */
export async function adminUploadMedia(
	cookie: string | null,
	file: File
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
	const buffer = Buffer.from(await file.arrayBuffer());
	const { status, data } = await authedJson(cookie, 'POST', '/api/media', {
		filename: file.name,
		mime: file.type,
		contentBase64: buffer.toString('base64')
	});
	if (status === 201) {
		return { ok: true, url: (data as { url: string }).url };
	}
	const message = (data as { message?: string } | null)?.message ?? `upload failed (${status})`;
	return { ok: false, error: message };
}
