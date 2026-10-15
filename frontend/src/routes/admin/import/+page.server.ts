/**
 * @file +page.server.ts
 * @brief Protected Obsidian ZIP or Markdown batch action without filesystem writes.
 */
import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { adminImportVault } from '../../../lib/server/obsidian-api.js';
import { readVaultForm } from '../../../lib/server/obsidian-zip.js';
import { readVaultUploads } from '../../../lib/server/obsidian-upload.js';
import { serverT } from '../../../lib/server/server-t.js';
import type { Actions } from './$types';

export const actions: Actions = {
	/** @brief Imports bounded vault uploads. @param event Form request. @return Import summary or safe failure. */
	default: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: serverT('vault.failed') });
		}
		const length = Number(request.headers.get('content-length'));
		if (length > 2_100_000) {
			return fail(413, { error: serverT('vault.invalid') });
		}
		let form: FormData;
		try {
			form = await readVaultForm(request);
		} catch {
			return fail(400, { error: serverT('vault.invalid') });
		}
		const visibility = z.enum(['private', 'public', 'readers']).safeParse(form.get('visibility'));
		if (!visibility.success || form.get('confirm') !== 'yes') {
			return fail(400, { error: serverT('vault.invalid') });
		}
		let sources;
		try {
			sources = await readVaultUploads(form.getAll('vault'));
		} catch {
			return fail(400, { error: serverT('vault.invalid') });
		}
		const result = await adminImportVault(
			request.headers.get('cookie'),
			sources.files,
			visibility.data
		);
		if (!result) {
			return fail(502, { error: serverT('vault.failed') });
		}
		return { result: { ...result, skipped: [...sources.skipped, ...result.skipped] } };
	}
};
