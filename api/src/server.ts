/**
 * @file server.ts
 * @brief HTTP API surface over repository contracts. Thin router, no framework.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { z } from 'zod';
import type {
	PostRepository,
	SessionRepository,
	TagRepository,
	UserRepository
} from './db/repositories.js';
import type { UserRow } from './db/schema.js';
import { flattenIssues } from './markdown/schema.js';
import { renderMarkdown } from './markdown/render.js';
import { sanitizeKey, type StorageProvider } from './media/storage.js';
import {
	createPost,
	deletePost,
	getPublishedPost,
	listPublishedPosts,
	PostError,
	updatePost,
	updatePostSchema
} from './posts/post-service.js';
import {
	buildSessionExpiry,
	clearSessionCookieHeader,
	createSessionToken,
	hashToken,
	parseCookies,
	SESSION_COOKIE,
	sessionCookieHeader
} from './auth/session.js';
import { verifyPassword } from './auth/password.js';
import { normalizeSlug } from './posts/publishing.js';

/**
 * @brief Dependencies injected into the request handler.
 */
export interface ApiDeps {
	users: UserRepository;
	sessions: SessionRepository;
	posts: PostRepository;
	tags: TagRepository;
	media: StorageProvider;
	cookieSecure: boolean;
}

/**
 * @brief Payload returned by the health endpoint.
 */
export interface HealthPayload {
	status: 'ok';
	service: 'blog-api';
}

/**
 * @brief Error payload returned for failed requests.
 */
export interface ErrorPayload {
	error:
		| 'not_found'
		| 'method_not_allowed'
		| 'validation'
		| 'unauthorized'
		| 'conflict'
		| 'too_large'
		| 'internal';
	message?: string;
	issues?: string[];
}

/** Default TCP port used when PORT is unset or invalid. */
export const DEFAULT_PORT = 3001;

/** Default JSON body cap for regular routes (256 KiB). */
const BODY_LIMIT = 256 * 1024;

/** JSON body cap for media uploads (8 MiB). */
const MEDIA_BODY_LIMIT = 8 * 1024 * 1024;

/** Public URL prefix under which media files are served. */
export const MEDIA_PREFIX = '/api/media';

/**
 * @brief Parses the PORT environment value into a valid TCP port.
 * @param raw The raw PORT value, possibly undefined.
 * @param fallback Port used when raw is missing or invalid.
 * @return A valid TCP port number.
 */
export function parsePort(raw: string | undefined, fallback: number = DEFAULT_PORT): number {
	const parsed = raw === undefined || raw === '' ? NaN : Number(raw);
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
		return fallback;
	}
	return parsed;
}

/**
 * @brief Sends a JSON response with the given status code.
 * @param res The outgoing response.
 * @param statusCode The HTTP status code.
 * @param payload The JSON-serializable payload.
 * @param headers Extra headers to set.
 */
function sendJson(
	res: ServerResponse,
	statusCode: number,
	payload: unknown,
	headers: Record<string, string> = {}
): void {
	res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', ...headers });
	res.end(JSON.stringify(payload));
}

/**
 * @brief Reads and parses a JSON request body with a size cap.
 * @param req The incoming request.
 * @param maxBytes The maximum accepted body size.
 * @return The parsed body or a failure reason.
 */
function readJsonBody(
	req: IncomingMessage,
	maxBytes: number
): Promise<{ ok: true; data: unknown } | { ok: false; reason: 'empty' | 'invalid' | 'too_large' }> {
	return new Promise((resolve) => {
		const chunks: Buffer[] = [];
		let size = 0;
		let settled = false;
		req.on('data', (chunk: Buffer) => {
			size += chunk.length;
			if (size > maxBytes && !settled) {
				settled = true;
				resolve({ ok: false, reason: 'too_large' });
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on('end', () => {
			if (settled) {
				return;
			}
			const text = Buffer.concat(chunks).toString('utf8');
			if (text.trim() === '') {
				resolve({ ok: false, reason: 'empty' });
				return;
			}
			try {
				resolve({ ok: true, data: JSON.parse(text) });
			} catch {
				resolve({ ok: false, reason: 'invalid' });
			}
		});
	});
}

/**
 * @brief Parses a positive integer query value with bounds.
 * @param raw The raw value, if any.
 * @param fallback The value used when raw is missing or invalid.
 * @param max The upper bound.
 * @return The parsed integer.
 */
function parseBoundedInt(raw: string | null, fallback: number, max: number): number {
	const parsed = raw === null ? NaN : Number(raw);
	if (!Number.isInteger(parsed) || parsed < 0) {
		return fallback;
	}
	return Math.min(parsed, max);
}

/**
 * @brief Maps a user row to its public DTO.
 * @param user The user row.
 * @return The public user object.
 */
function toUserDto(user: UserRow): { id: string; email: string; name: string; role: string } {
	return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/**
 * @brief Resolves the session user from the request cookie.
 * @param req The incoming request.
 * @param deps The API dependencies.
 * @return The user row or null.
 */
async function getSessionUser(req: IncomingMessage, deps: ApiDeps): Promise<UserRow | null> {
	const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
	if (token === undefined || token === '') {
		return null;
	}
	const found = await deps.sessions.findByTokenHash(hashToken(token));
	if (found === null) {
		return null;
	}
	if (found.expiresAt <= new Date()) {
		await deps.sessions.deleteByTokenHash(found.tokenHash);
		return null;
	}
	return found.user;
}

/**
 * @brief Requires an authenticated user for the request.
 * @param req The incoming request.
 * @param res The outgoing response (401 sent on failure).
 * @param deps The API dependencies.
 * @return The user row or null when unauthorized.
 */
async function requireUser(
	req: IncomingMessage,
	res: ServerResponse,
	deps: ApiDeps
): Promise<UserRow | null> {
	const user = await getSessionUser(req, deps);
	if (user === null) {
		sendJson(res, 401, { error: 'unauthorized' } satisfies ErrorPayload);
		return null;
	}
	return user;
}

/**
 * @brief Maps a PostError to its HTTP status code.
 * @param error The domain error.
 * @return The status code.
 */
function postErrorStatus(error: PostError): number {
	if (error.code === 'not_found') {
		return 404;
	}
	if (error.code === 'conflict') {
		return 409;
	}
	return 400;
}

const loginSchema = z.object({
	email: z.email().max(254),
	password: z.string().min(1).max(200)
});

const mediaUploadSchema = z.object({
	filename: z.string().min(1).max(200),
	mime: z.string().min(1).max(100),
	contentBase64: z.string().min(1).max(7_500_000)
});

/**
 * @brief Handles user login: verifies credentials and sets the session cookie.
 */
async function handleLogin(req: IncomingMessage, res: ServerResponse, deps: ApiDeps): Promise<void> {
	const body = await readJsonBody(req, BODY_LIMIT);
	if (!body.ok) {
		sendJson(res, 400, { error: 'validation', message: `invalid body: ${body.reason}` } satisfies ErrorPayload);
		return;
	}
	const parsed = loginSchema.safeParse(body.data);
	if (!parsed.success) {
		sendJson(res, 400, { error: 'validation', issues: flattenIssues(parsed.error) } satisfies ErrorPayload);
		return;
	}
	const user = await deps.users.findByEmail(parsed.data.email.toLowerCase());
	const valid = user !== null && (await verifyPassword(parsed.data.password, user.passwordHash));
	if (!valid || user === null) {
		sendJson(res, 401, { error: 'unauthorized', message: 'invalid credentials' } satisfies ErrorPayload);
		return;
	}
	const session = createSessionToken();
	const { randomUUID } = await import('node:crypto');
	await deps.sessions.create({
		id: randomUUID(),
		tokenHash: session.tokenHash,
		userId: user.id,
		expiresAt: buildSessionExpiry()
	});
	sendJson(res, 200, { user: toUserDto(user) }, { 'set-cookie': sessionCookieHeader(session.token, deps.cookieSecure) });
}

/**
 * @brief Handles user logout: deletes the session and clears the cookie.
 */
async function handleLogout(req: IncomingMessage, res: ServerResponse, deps: ApiDeps): Promise<void> {
	const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
	if (token !== undefined && token !== '') {
		await deps.sessions.deleteByTokenHash(hashToken(token));
	}
	sendJson(res, 200, { ok: true }, { 'set-cookie': clearSessionCookieHeader() });
}

/**
 * @brief Returns the current session user.
 */
async function handleMe(req: IncomingMessage, res: ServerResponse, deps: ApiDeps): Promise<void> {
	const user = await getSessionUser(req, deps);
	if (user === null) {
		sendJson(res, 401, { error: 'unauthorized' } satisfies ErrorPayload);
		return;
	}
	sendJson(res, 200, { user: toUserDto(user) });
}

/**
 * @brief Lists published posts with pagination and optional tag filter.
 */
async function handleListPosts(
	req: IncomingMessage,
	res: ServerResponse,
	deps: ApiDeps,
	url: URL
): Promise<void> {
	const limit = parseBoundedInt(url.searchParams.get('limit'), 10, 200);
	const offset = parseBoundedInt(url.searchParams.get('offset'), 0, 1_000_000);
	const tag = url.searchParams.get('tag') ?? undefined;
	const page = await listPublishedPosts(deps, { limit, offset, tag });
	sendJson(res, 200, page);
}

/**
 * @brief Returns one published post by slug (drafts mask as 404).
 */
async function handleGetPost(
	res: ServerResponse,
	deps: ApiDeps,
	slug: string
): Promise<void> {
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) {
		sendJson(res, 404, { error: 'not_found' } satisfies ErrorPayload);
		return;
	}
	const post = await getPublishedPost(deps, normalizeSlug(slug));
	if (post === null) {
		sendJson(res, 404, { error: 'not_found' } satisfies ErrorPayload);
		return;
	}
	sendJson(res, 200, post);
}

/**
 * @brief Creates a post (authenticated).
 */
async function handleCreatePost(
	req: IncomingMessage,
	res: ServerResponse,
	deps: ApiDeps,
	user: UserRow
): Promise<void> {
	const body = await readJsonBody(req, BODY_LIMIT);
	if (!body.ok) {
		sendJson(res, 400, { error: 'validation', message: `invalid body: ${body.reason}` } satisfies ErrorPayload);
		return;
	}
	try {
		const item = await createPost(deps, body.data, user.id);
		sendJson(res, 201, item);
	} catch (error) {
		if (error instanceof PostError) {
			sendJson(res, postErrorStatus(error), {
				error: error.code === 'conflict' ? 'conflict' : 'validation',
				message: error.message
			} satisfies ErrorPayload);
			return;
		}
		throw error;
	}
}

/**
 * @brief Updates a post by id (authenticated).
 */
async function handleUpdatePost(
	req: IncomingMessage,
	res: ServerResponse,
	deps: ApiDeps,
	id: string
): Promise<void> {
	const body = await readJsonBody(req, BODY_LIMIT);
	if (!body.ok) {
		sendJson(res, 400, { error: 'validation', message: `invalid body: ${body.reason}` } satisfies ErrorPayload);
		return;
	}
	try {
		const parsed = updatePostSchema.safeParse(body.data);
		if (!parsed.success) {
			sendJson(res, 400, { error: 'validation', issues: flattenIssues(parsed.error) } satisfies ErrorPayload);
			return;
		}
		const item = await updatePost(deps, id, parsed.data);
		sendJson(res, 200, item);
	} catch (error) {
		if (error instanceof PostError) {
			const status = postErrorStatus(error);
			sendJson(res, status, {
				error: status === 404 ? 'not_found' : status === 409 ? 'conflict' : 'validation',
				message: error.message
			} satisfies ErrorPayload);
			return;
		}
		throw error;
	}
}

/**
 * @brief Lists tags with published-post counts.
 */
async function handleListTags(res: ServerResponse, deps: ApiDeps): Promise<void> {
	const all = await deps.tags.list();
	const now = new Date();
	const items: { name: string; slug: string; count: number }[] = [];
	for (const tag of all) {
		const page = await deps.posts.listPublished({ limit: 1, offset: 0, tag: tag.name, now });
		items.push({ name: tag.name, slug: tag.slug, count: page.total });
	}
	sendJson(res, 200, { items });
}

/**
 * @brief Returns one post by id including drafts (authenticated admin view).
 */
async function handleAdminGetPost(
	req: IncomingMessage,
	res: ServerResponse,
	deps: ApiDeps,
	id: string
): Promise<void> {
	const user = await requireUser(req, res, deps);
	if (user === null) {
		return;
	}
	const row = await deps.posts.findById(id);
	if (row === null) {
		sendJson(res, 404, { error: 'not_found' } satisfies ErrorPayload);
		return;
	}
	const author = row.authorId === null ? null : await deps.users.findById(row.authorId);
	sendJson(res, 200, {
		id: row.id,
		slug: row.slug,
		title: row.title,
		description: row.description,
		status: row.status,
		tags: await deps.tags.getPostTagNames(row.id),
		authorName: author?.name ?? null,
		publishedAt: row.publishedAt?.toISOString() ?? null,
		contentMarkdown: row.contentMarkdown,
		contentHtml: row.contentHtml,
		coverImage: row.coverImage
	});
}

const renderSchema = z.object({ markdown: z.string().min(1).max(200_000) });

/**
 * @brief Renders Markdown to sanitized HTML for editor previews (authenticated).
 */
async function handleRenderPreview(
	req: IncomingMessage,
	res: ServerResponse,
	deps: ApiDeps
): Promise<void> {
	const user = await requireUser(req, res, deps);
	if (user === null) {
		return;
	}
	const body = await readJsonBody(req, BODY_LIMIT);
	if (!body.ok) {
		sendJson(res, 400, { error: 'validation', message: `invalid body: ${body.reason}` } satisfies ErrorPayload);
		return;
	}
	const parsed = renderSchema.safeParse(body.data);
	if (!parsed.success) {
		sendJson(res, 400, { error: 'validation', issues: flattenIssues(parsed.error) } satisfies ErrorPayload);
		return;
	}
	const rendered = await renderMarkdown(parsed.data.markdown, { mediaPrefix: MEDIA_PREFIX });
	sendJson(res, 200, { html: rendered.html });
}

/**
 * @brief Lists every post including drafts (authenticated admin view).
 */
async function handleAdminListPosts(
	req: IncomingMessage,
	res: ServerResponse,
	deps: ApiDeps
): Promise<void> {
	const user = await requireUser(req, res, deps);
	if (user === null) {
		return;
	}
	const rows = await deps.posts.listAll();
	const items = [];
	for (const row of rows) {
		const author = row.authorId === null ? null : await deps.users.findById(row.authorId);
		items.push({
			id: row.id,
			slug: row.slug,
			title: row.title,
			description: row.description,
			status: row.status,
			tags: row.tags,
			authorName: author?.name ?? null,
			publishedAt: row.publishedAt?.toISOString() ?? null,
			updatedAt: row.updatedAt.toISOString()
		});
	}
	sendJson(res, 200, { items, total: items.length });
}

/**
 * @brief Stores an authenticated media upload (JSON base64 payload).
 */
async function handleUploadMedia(
	req: IncomingMessage,
	res: ServerResponse,
	deps: ApiDeps
): Promise<void> {
	const user = await requireUser(req, res, deps);
	if (user === null) {
		return;
	}
	const body = await readJsonBody(req, MEDIA_BODY_LIMIT);
	if (!body.ok) {
		const error = body.reason === 'too_large' ? 'too_large' : 'validation';
		sendJson(res, body.reason === 'too_large' ? 413 : 400, { error } satisfies ErrorPayload);
		return;
	}
	const parsed = mediaUploadSchema.safeParse(body.data);
	if (!parsed.success) {
		sendJson(res, 400, { error: 'validation', issues: flattenIssues(parsed.error) } satisfies ErrorPayload);
		return;
	}
	try {
		const data = Buffer.from(parsed.data.contentBase64, 'base64');
		const record = await deps.media.save(data, parsed.data.filename, parsed.data.mime);
		sendJson(res, 201, { ...record, url: `${MEDIA_PREFIX}/${record.key}` });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'upload failed';
		sendJson(res, 400, { error: 'validation', message } satisfies ErrorPayload);
	}
}

/**
 * @brief Serves a stored media file by key.
 */
async function handleGetMedia(res: ServerResponse, deps: ApiDeps, key: string): Promise<void> {
	const safe = sanitizeKey(key);
	if (safe === null) {
		sendJson(res, 404, { error: 'not_found' } satisfies ErrorPayload);
		return;
	}
	const file = await deps.media.load(safe);
	if (file === null) {
		sendJson(res, 404, { error: 'not_found' } satisfies ErrorPayload);
		return;
	}
	res.writeHead(200, {
		'content-type': file.mime,
		'content-length': file.data.length,
		'cache-control': 'public, max-age=31536000, immutable'
	});
	res.end(file.data);
}

/**
 * @brief Routes one request to its handler.
 * @param req The incoming request.
 * @param res The outgoing response.
 * @param deps The API dependencies.
 */
async function handleRequest(req: IncomingMessage, res: ServerResponse, deps: ApiDeps): Promise<void> {
	const url = new URL(req.url ?? '/', 'http://localhost');
	const pathname = url.pathname;
	const method = req.method ?? 'GET';

	if (method === 'GET' && pathname === '/health') {
		sendJson(res, 200, { status: 'ok', service: 'blog-api' });
		return;
	}
	if (method === 'POST' && pathname === '/api/auth/login') {
		await handleLogin(req, res, deps);
		return;
	}
	if (method === 'POST' && pathname === '/api/auth/logout') {
		await handleLogout(req, res, deps);
		return;
	}
	if (method === 'GET' && pathname === '/api/auth/me') {
		await handleMe(req, res, deps);
		return;
	}
	if (method === 'GET' && pathname === '/api/posts') {
		await handleListPosts(req, res, deps, url);
		return;
	}
	if (method === 'GET' && pathname === '/api/tags') {
		await handleListTags(res, deps);
		return;
	}
	if (method === 'GET' && pathname === '/api/admin/posts') {
		await handleAdminListPosts(req, res, deps);
		return;
	}
	if (pathname.startsWith('/api/admin/posts/')) {
		const id = pathname.slice('/api/admin/posts/'.length);
		if (method === 'GET' && id !== '' && !id.includes('/')) {
			await handleAdminGetPost(req, res, deps, id);
			return;
		}
	}
	if (method === 'POST' && pathname === '/api/render') {
		await handleRenderPreview(req, res, deps);
		return;
	}
	if (method === 'POST' && pathname === '/api/posts') {
		const user = await requireUser(req, res, deps);
		if (user === null) {
			return;
		}
		await handleCreatePost(req, res, deps, user);
		return;
	}
	if (method === 'POST' && pathname === '/api/media') {
		await handleUploadMedia(req, res, deps);
		return;
	}
	if (pathname.startsWith('/api/posts/')) {
		const slug = pathname.slice('/api/posts/'.length);
		if (slug === '' || slug.includes('/')) {
			sendJson(res, 404, { error: 'not_found' } satisfies ErrorPayload);
			return;
		}
		if (method === 'GET') {
			await handleGetPost(res, deps, slug);
			return;
		}
		if (method === 'PUT' || method === 'DELETE') {
			const user = await requireUser(req, res, deps);
			if (user === null) {
				return;
			}
			if (method === 'DELETE') {
				const deleted = await deletePost(deps, slug);
				if (!deleted) {
					sendJson(res, 404, { error: 'not_found' } satisfies ErrorPayload);
					return;
				}
				res.writeHead(204);
				res.end();
				return;
			}
			await handleUpdatePost(req, res, deps, slug);
			return;
		}
	}
	if (pathname.startsWith(`${MEDIA_PREFIX}/`)) {
		const key = pathname.slice(MEDIA_PREFIX.length + 1);
		if (method === 'GET' && !key.includes('/')) {
			await handleGetMedia(res, deps, key);
			return;
		}
		if (method === 'DELETE' && !key.includes('/')) {
			const user = await requireUser(req, res, deps);
			if (user === null) {
				return;
			}
			const deleted = await deps.media.remove(key);
			if (!deleted) {
				sendJson(res, 404, { error: 'not_found' } satisfies ErrorPayload);
				return;
			}
			res.writeHead(204);
			res.end();
			return;
		}
	}
	if (
		pathname === '/health' ||
		pathname.startsWith('/api/') ||
		pathname.startsWith(`${MEDIA_PREFIX}/`)
	) {
		sendJson(res, 405, { error: 'method_not_allowed' } satisfies ErrorPayload);
		return;
	}
	sendJson(res, 404, { error: 'not_found' } satisfies ErrorPayload);
}

/**
 * @brief Creates the API request handler (no framework, plain node:http).
 * @param deps The API dependencies.
 * @return A request handler serving the API routes.
 */
export function createHandler(deps: ApiDeps): (req: IncomingMessage, res: ServerResponse) => void {
	return (req: IncomingMessage, res: ServerResponse): void => {
		handleRequest(req, res, deps).catch(() => {
			if (!res.headersSent) {
				sendJson(res, 500, { error: 'internal' } satisfies ErrorPayload);
			}
		});
	};
}

/**
 * @brief Starts the API server on the given port.
 * @param port The TCP port to listen on.
 * @param handler The request handler.
 * @return The running HTTP server.
 */
export function startServer(
	port: number,
	handler: (req: IncomingMessage, res: ServerResponse) => void
): Server {
	const server = createServer(handler);
	server.listen(port);
	return server;
}
