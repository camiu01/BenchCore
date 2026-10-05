/**
 * @file handler.ts
 * @brief Lazy Node service dispatcher without listeners, migrations or scheduler jobs.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { securityHeaders } from '../http/security.js';
import { sendJson } from '../http/response.js';
import { createServerlessApp } from './app.js';

/**
 * @brief Creates an independently deployable API service with generic health probes.
 * @param env Runtime environment.
 * @param factory Optional offline application factory.
 * @return Vercel-compatible Node request handler.
 */
export function createVercelHandler(env: NodeJS.ProcessEnv, factory = createServerlessApp) {
	let app: ReturnType<typeof createServerlessApp> | undefined;
	/** @brief Initializes dependencies only on API and readiness calls. @return Application. */
	const application = () => app ??= factory(env);
	/**
	 * @brief Handles public and internally bound requests with unchanged /api paths.
	 * @param req Node request. @param res Node response.
	 * @return Completed health dispatch or delegated API handling.
	 */
	return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
		securityHeaders(res, env['NODE_ENV'] === 'production');
		try {
			const path = new URL(req.url ?? '/', 'http://localhost').pathname;
			if (['/health', '/health/live', '/health/ready'].includes(path)) {
				if (req.method !== 'GET') {
					sendJson(res, 405, { error: 'method_not_allowed' }, { allow: 'GET' }); return;
				}
				if (path === '/health/ready') { await application().ready(); }
				sendJson(res, 200, { status: 'ok' }); return;
			}
			application().handler(req, res);
		} catch {
			if (!res.headersSent) { sendJson(res, 503, { error: 'unavailable' }); }
			else { res.end(); }
		}
	};
}
