/**
 * @file server.ts
 * @brief Framework-free HTTP router with security applied before endpoint dispatch.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { ApiDeps, ApiHandler } from './http/types.js';
import { sendJson } from './http/response.js';
import { createSecurityGuard, securityHeaders } from './http/security.js';
import { handleLogin, handleLogout, handleMe } from './http/auth.js';
import { handleAdminPostSuggestions, handleAdminPosts, handleAdminTags, handleGetPost, handleListPosts, handleListTags,
	handleRenderPreview, handleWritePost } from './http/posts.js';
import { handleMedia, handleUploadMedia } from './http/media.js';
import { handleAdminMedia } from './http/media-admin.js';
import {
	handleChangePassword,
	handlePasswordReset,
	handlePasswordResetRequest,
	handleRegister,
	handleUsers
} from './http/accounts.js';
import { handlePrepareUpload, handleCompleteUpload } from './http/direct-media.js';
import { handleGraph } from './http/graph.js';
import {
	handleAdminComment,
	handleAdminComments,
	handleComments,
	handleLikes
} from './http/engagement.js';

export type { ApiDeps, ErrorPayload } from './http/types.js';
export { MEDIA_PREFIX } from './http/response.js';

export interface HealthPayload {
	status: 'ok';
	service: 'benchcore-api';
}

export const DEFAULT_PORT = 5181;

const routes: { path: RegExp; handlers: Record<string, ApiHandler> }[] = [
	{ path: /^\/api\/auth\/login$/, handlers: { POST: handleLogin } },
	{ path: /^\/api\/auth\/register$/, handlers: { POST: handleRegister } },
	{ path: /^\/api\/auth\/password$/, handlers: { POST: handleChangePassword } },
	{ path: /^\/api\/auth\/password\/forgot$/, handlers: { POST: handlePasswordResetRequest } },
	{ path: /^\/api\/auth\/password\/reset$/, handlers: { POST: handlePasswordReset } },
	{ path: /^\/api\/auth\/logout$/, handlers: { POST: handleLogout } },
	{ path: /^\/api\/auth\/me$/, handlers: { GET: handleMe } },
	{ path: /^\/api\/posts$/, handlers: { GET: handleListPosts, POST: handleWritePost } },
	{ path: /^\/api\/posts\/([^/]+)$/, handlers: { GET: handleGetPost, PUT: handleWritePost, DELETE: handleWritePost } },
	{ path: /^\/api\/posts\/([^/]+)\/comments$/, handlers: { GET: handleComments, POST: handleComments } },
	{ path: /^\/api\/posts\/([^/]+)\/likes$/, handlers: { GET: handleLikes, POST: handleLikes } },
	{ path: /^\/api\/tags$/, handlers: { GET: handleListTags } },
	{ path: /^\/api\/graph$/, handlers: { GET: handleGraph } },
	{ path: /^\/api\/admin\/posts\/suggestions$/, handlers: { GET: handleAdminPostSuggestions } },
	{ path: /^\/api\/admin\/posts(?:\/([^/]+))?$/, handlers: { GET: handleAdminPosts } },
	{ path: /^\/api\/admin\/tags$/, handlers: { GET: handleAdminTags } },
	{ path: /^\/api\/admin\/tags\/([^/]+)$/, handlers: { PATCH: handleAdminTags, DELETE: handleAdminTags } },
	{ path: /^\/api\/admin\/comments$/, handlers: { GET: handleAdminComments } },
	{ path: /^\/api\/admin\/comments\/([^/]+)$/, handlers: { PATCH: handleAdminComment, DELETE: handleAdminComment } },
	{ path: /^\/api\/admin\/users$/, handlers: { GET: handleUsers, POST: handleUsers } },
	{ path: /^\/api\/admin\/media\/([^/]+)$/, handlers: { GET: handleAdminMedia, DELETE: handleAdminMedia } },
	{ path: /^\/api\/admin\/users\/([^/]+)$/, handlers: { PATCH: handleUsers } },
	{ path: /^\/api\/render$/, handlers: { POST: handleRenderPreview } },
	{ path: /^\/api\/media$/, handlers: { POST: handleUploadMedia } },
	{ path: /^\/api\/media\/upload$/, handlers: { POST: handlePrepareUpload } },
	{ path: /^\/api\/media\/complete$/, handlers: { POST: handleCompleteUpload } },
	{ path: /^\/api\/media\/([^/]+)$/, handlers: { GET: handleMedia, DELETE: handleMedia } }
];

/**
 * @brief Parses a TCP port with a safe fallback.
 * @param raw Environment string.
 * @param fallback Default port.
 * @return Valid TCP port.
 */
export function parsePort(raw: string | undefined, fallback: number = DEFAULT_PORT): number {
	const parsed = raw === undefined || raw === '' ? NaN : Number(raw);
	return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : fallback;
}

/**
 * @brief Dispatches an API request while distinguishing unknown paths from unsupported methods.
 * @param req Incoming request.
 * @param res Response stream.
 * @param deps Repositories and storage.
 * @param url Parsed URL.
 * @return Nothing.
 */
async function handleRequest(req: IncomingMessage, res: ServerResponse, deps: ApiDeps, url: URL): Promise<void> {
	const method = req.method ?? 'GET';
	if (url.pathname === '/health') {
		if (method === 'GET') { sendJson(res, 200, { status: 'ok', service: 'benchcore-api' }); }
		else { sendJson(res, 405, { error: 'method_not_allowed' }, { allow: 'GET' }); }
		return;
	}
	for (const route of routes) {
		const match = route.path.exec(url.pathname);
		if (!match) { continue; }
		const handler = route.handlers[method];
		if (!handler) {
			sendJson(res, 405, { error: 'method_not_allowed' }, { allow: Object.keys(route.handlers).join(', ') }); return;
		}
		await handler(req, res, deps, url, match[1] ?? '');
		return;
	}
	sendJson(res, 404, { error: 'not_found' });
}

/**
 * @brief Creates an isolated secured API handler.
 * @param deps Dependencies.
 * @return Node HTTP request handler.
 */
export function createHandler(deps: ApiDeps): (req: IncomingMessage, res: ServerResponse) => void {
	const guard = createSecurityGuard(deps);
	return (req, res) => {
		securityHeaders(res, deps.cookieSecure);
		let url: URL;
		try { url = new URL(req.url ?? '/', 'http://localhost'); }
		catch { sendJson(res, 400, { error: 'validation' }); return; }
		if (!guard(req, res, url)) { req.resume(); return; }
		handleRequest(req, res, deps, url).catch(() => {
			if (!res.headersSent) { sendJson(res, 500, { error: 'internal' }); }
			else { res.end(); }
		});
	};
}

/**
 * @brief Starts an HTTP server on a selected interface.
 * @param port TCP port, or zero for ephemeral tests.
 * @param handler Request handler.
 * @param host Optional bind address.
 * @return Running server.
 */
export function startServer(port: number, handler: (req: IncomingMessage, res: ServerResponse) => void,
	host?: string): Server {
	const server = createServer(handler);
	server.requestTimeout = 30_000;
	server.headersTimeout = 15_000;
	server.listen(port, host);
	return server;
}
