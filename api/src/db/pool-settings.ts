/**
 * @file pool-settings.ts
 * @brief Bounded PostgreSQL pools with explicit transaction-pooler compatibility.
 */
import { z } from 'zod';

const settings = z.object({
	DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20),
	DATABASE_POOL_IDLE_SECONDS: z.coerce.number().int().min(1).max(600),
	DATABASE_POOL_LIFETIME_SECONDS: z.coerce.number().int().min(30).max(3600),
	DATABASE_POOL_MODE: z.enum(['session', 'transaction'])
});

/**
 * @brief Validates pool limits without including connection credentials in errors.
 * @param env Server runtime environment.
 * @return Postgres.js options, disabling prepared statements for transaction poolers.
 */
export function poolSettings(env: NodeJS.ProcessEnv) {
	const serverless = env['VERCEL'] === '1' || env['DEPLOYMENT_TARGET'] === 'vercel';
	const parsed = settings.safeParse({
		DATABASE_POOL_MAX: env['DATABASE_POOL_MAX'] ?? (serverless ? 3 : 10),
		DATABASE_POOL_IDLE_SECONDS: env['DATABASE_POOL_IDLE_SECONDS'] ?? (serverless ? 10 : 30),
		DATABASE_POOL_LIFETIME_SECONDS: env['DATABASE_POOL_LIFETIME_SECONDS'] ?? 300,
		DATABASE_POOL_MODE: env['DATABASE_POOL_MODE'] ?? (serverless ? 'transaction' : 'session')
	});
	if (!parsed.success) {
		throw new Error('Invalid PostgreSQL pool settings');
	}
	const values = parsed.data;
	return {
		max: values.DATABASE_POOL_MAX,
		idle_timeout: values.DATABASE_POOL_IDLE_SECONDS,
		max_lifetime: values.DATABASE_POOL_LIFETIME_SECONDS,
		prepare: values.DATABASE_POOL_MODE === 'session',
		connect_timeout: 5,
		connection: { statement_timeout: 10_000 }
	};
}
