/**
 * @file app.ts
 * @brief API-owned serverless wiring with no listeners, migrations or publishing timers.
 */
import { createHandler } from '../server.js';
import { createDrizzleRepos } from '../db/drizzle.js';
import { getDb, checkDb } from '../db/client.js';
import { configuredStorage } from '../media/configured.js';
import { configuredOrigins } from '../http/security.js';
import { nodeHandlerFetch } from '../http/web.js';
import { configuredPasswordReset } from '../auth/password-reset-delivery.js';

/**
 * @brief Validates Vercel configuration and wires the same API services as Node delivery.
 * @param env Runtime environment.
 * @return In-process API and readiness functions.
 */
export function createServerlessApp(env: NodeJS.ProcessEnv) {
	const origins = configuredOrigins(env);
	if (env['NODE_ENV'] === 'production' && origins.some((origin) => !origin.startsWith('https://'))) {
		throw new Error('Serverless production requires HTTPS origins');
	}
	if (env['VERCEL_URL']) {
		if (!/^[a-zA-Z0-9-]+\.vercel\.app$/.test(env['VERCEL_URL'])) { throw new Error('Invalid deployment hostname'); }
		origins.push(`https://${env['VERCEL_URL']}`);
	}
	const db = getDb();
	const passwordReset = configuredPasswordReset(env);
	const handler = createHandler({ ...createDrizzleRepos(db), media: configuredStorage(db, env),
		...(passwordReset ? { passwordReset } : {}),
		cookieSecure: env['NODE_ENV'] === 'production', allowedOrigins: origins });
	return {
		handler,
		/** @brief Executes secured API requests with the hosting platform's peer identity. */
		fetch: (request: Request, address: string) => nodeHandlerFetch(handler, request, address),
		/** @brief Probes schema and connectivity without reading user content. */
		ready: () => checkDb()
	};
}
