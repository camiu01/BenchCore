/**
 * @file configured.ts
 * @brief Selects storage without exposing provider details to services or routes.
 */
import { createDrizzleMedia } from '../db/drizzle-media.js';
import type { AppDb } from '../db/client.js';
import { createDatabaseStorage, createLocalStorage, type StorageProvider } from './storage.js';
import { createR2Storage } from './r2.js';

/**
 * @brief Chooses a private persistent backend and refuses ephemeral local Vercel storage.
 * @param db API database handle.
 * @param env Runtime configuration.
 * @return Storage provider.
 */
export function configuredStorage(db: AppDb, env: NodeJS.ProcessEnv): StorageProvider {
	const backend = env['MEDIA_STORAGE'] ?? (env['VERCEL'] === '1' ? 'r2' : 'local');
	if (backend === 'r2') { return createR2Storage(env); }
	if (backend === 'database') { return createDatabaseStorage(createDrizzleMedia(db)); }
	if (backend === 'local' && env['VERCEL'] !== '1') {
		return createLocalStorage(env['MEDIA_DIR'] ?? './data/media');
	}
	throw new Error('MEDIA_STORAGE must be local, database or r2; local is unavailable on Vercel');
}
