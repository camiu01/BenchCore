/**
 * @file obsidian-api.ts
 * @brief Cookie-forwarding administrator vault import client with response validation.
 */
import { z } from 'zod';
import { apiBase } from '../api.js';
import { mutationOrigin } from '../site.js';
import { apiFetch } from './transport.js';
import type { VaultSources } from './obsidian-zip.js';

const issue = z.object({ file: z.string(), message: z.string() });
const resultSchema = z.object({
	created: z.array(z.string()),
	skipped: z.array(z.string()),
	errors: z.array(issue),
	warnings: z.array(issue)
});

/**
 * @brief Sends validated sources to the fixed protected import endpoint.
 * @param cookie Administrator session cookie.
 * @param files Extracted Markdown sources.
 * @param visibility Explicit publication mode.
 * @return Validated import summary or null on failure.
 */
export async function adminImportVault(
	cookie: string | null,
	files: VaultSources['files'],
	visibility: 'private' | 'public' | 'readers'
) {
	try {
		const response = await apiFetch(`${apiBase()}/api/admin/imports/obsidian`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				cookie: cookie ?? '',
				origin: mutationOrigin()
			},
			body: JSON.stringify({ files, visibility }),
			signal: AbortSignal.timeout(60_000)
		});
		if (!response.ok) {
			return null;
		}
		const parsed = resultSchema.safeParse(await response.json());
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}
