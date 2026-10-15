/**
 * @file category-api.ts
 * @brief Validated public and administrator category transport.
 */
import { z } from 'zod';
import { apiBase } from '../api.js';
import { mutationOrigin } from '../site.js';
import { apiFetch } from './transport.js';

const categoriesSchema = z.object({
	items: z.array(z.object({ name: z.string(), count: z.number().int().nonnegative() }))
});

/** @brief Loads assigned category counts. @param cookie Optional admin cookie. @param admin Include draft assignments. @return Counts or null. */
export async function getCategories(cookie: string | null = null, admin = false) {
	try {
		const response = await apiFetch(`${apiBase()}/api/${admin ? 'admin/' : ''}categories`, {
			headers: cookie ? { cookie } : {},
			signal: AbortSignal.timeout(5000)
		});
		if (!response.ok) {
			return null;
		}
		const parsed = categoriesSchema.safeParse(await response.json());
		return parsed.success ? parsed.data.items : null;
	} catch {
		return null;
	}
}

/** @brief Renames or clears category assignments. @param cookie Admin session. @param name Existing category. @param replacement Replacement or null. @return Whether accepted. */
export async function replaceCategory(
	cookie: string | null,
	name: string,
	replacement: string | null
) {
	try {
		const response = await apiFetch(`${apiBase()}/api/admin/categories`, {
			method: 'POST',
			headers: {
				cookie: cookie ?? '',
				origin: mutationOrigin(),
				'content-type': 'application/json'
			},
			body: JSON.stringify({ name, replacement }),
			signal: AbortSignal.timeout(10000)
		});
		return response.ok;
	} catch {
		return false;
	}
}
