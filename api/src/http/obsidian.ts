/**
 * @file obsidian.ts
 * @brief Administrator-only bounded Obsidian import endpoint.
 */
import { importObsidianVault } from '../posts/obsidian-import.js';
import { vaultImportSchema } from '../posts/obsidian-source.js';
import { requireUser } from './auth.js';
import { readBody, sendJson } from './response.js';
import type { ApiHandler } from './types.js';

/**
 * @brief Validates vault sources after administrator authentication.
 * @param req Incoming request.
 * @param res Response stream.
 * @param deps Repository dependencies.
 * @return Nothing.
 */
export const handleObsidianImport: ApiHandler = async (req, res, deps) => {
	const user = await requireUser(req, res, deps);
	if (!user) { return; }
	const body = await readBody(req, res, 4_000_000);
	if (!body) { return; }
	const parsed = vaultImportSchema.safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
	sendJson(res, 200, await importObsidianVault(parsed.data, deps, user.id));
};
