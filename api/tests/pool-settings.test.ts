/**
 * @file pool-settings.test.ts
 * @brief Pool limits and transaction-pooler safety without network access.
 */
import { describe, expect, it } from 'vitest';
import { poolSettings } from '../src/db/pool-settings.js';

describe('PostgreSQL pool settings', () => {
	it('bounds standalone pools and idle connection lifetime', () => {
		expect(poolSettings({})).toEqual({
			max: 10, idle_timeout: 30, max_lifetime: 300, prepare: true,
			connect_timeout: 5, connection: { statement_timeout: 10_000 }
		});
	});
	it.each([{ VERCEL: '1' }, { DEPLOYMENT_TARGET: 'vercel' }])(
		'uses small transaction-safe serverless defaults for %o', (env) => {
			expect(poolSettings(env)).toMatchObject({ max: 3, idle_timeout: 10, prepare: false });
		}
	);
	it('supports a standalone transaction pooler with explicit bounded overrides', () => {
		expect(poolSettings({
			DATABASE_POOL_MAX: '2', DATABASE_POOL_IDLE_SECONDS: '15',
			DATABASE_POOL_LIFETIME_SECONDS: '120', DATABASE_POOL_MODE: 'transaction'
		})).toMatchObject({ max: 2, idle_timeout: 15, max_lifetime: 120, prepare: false });
	});
	it.each([
		{ DATABASE_POOL_MAX: '0' }, { DATABASE_POOL_MAX: '21' },
		{ DATABASE_POOL_MAX: '1.5' }, { DATABASE_POOL_MAX: '' },
		{ DATABASE_POOL_IDLE_SECONDS: 'NaN' }, { DATABASE_POOL_IDLE_SECONDS: '601' },
		{ DATABASE_POOL_LIFETIME_SECONDS: '29' }, { DATABASE_POOL_LIFETIME_SECONDS: '3601' },
		{ DATABASE_POOL_MODE: 'automatic' }
	])('rejects invalid configuration without disclosing environment values: %o', (env) => {
		expect(() => poolSettings({ ...env, DATABASE_URL: 'private-connection' }))
			.toThrow('Invalid PostgreSQL pool settings');
	});
});
