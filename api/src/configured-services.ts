/**
 * @file configured-services.ts
 * @brief Shared service wiring for standalone, unified Node and Vercel entrypoints.
 */
import type { AppDb } from './db/client.js';
import { createDrizzleRepos } from './db/drizzle.js';
import { createDrizzleNewsletter } from './db/drizzle-newsletter.js';
import { configuredStorage } from './media/configured.js';
import { configuredPasswordReset } from './auth/password-reset-delivery.js';
import { configuredTotpKey } from './auth/totp.js';
import { configuredNewsletter } from './newsletter/delivery.js';

/** @brief Builds the same configured services without listeners, jobs, migrations or mail sends. @param db Runtime database. @param env Explicit provider settings. @return Handler service dependencies. */
export function configuredServices(db: AppDb, env: NodeJS.ProcessEnv) {
	const passwordReset = configuredPasswordReset(env);
	const totpKey = configuredTotpKey(env);
	const mail = configuredNewsletter(env);
	return {
		...createDrizzleRepos(db),
		media: configuredStorage(db, env),
		newsletter: { repository: createDrizzleNewsletter(db), ...(mail ? { mail } : {}) },
		...(passwordReset ? { passwordReset } : {}),
		...(totpKey ? { totpKey } : {})
	};
}
