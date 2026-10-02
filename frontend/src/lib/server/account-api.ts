/**
 * @file account-api.ts
 * @brief Validated account transport for registration, password rotation and user administration.
 */
import { z } from 'zod';
import { apiBase } from '../api.js';
import { mutationOrigin } from '../site.js';
import { apiFetch } from './transport.js';

export const accountSchema = z.object({
	id: z.uuid(),
	email: z.email(),
	username: z.string().nullable(),
	name: z.string(),
	role: z.enum(['admin', 'reader', 'editor']),
	isActive: z.boolean(),
	createdAt: z.iso.datetime({ offset: true })
});
const pageSchema = z.object({
	items: z.array(accountSchema),
	total: z.number().int().nonnegative()
});

/**
 * @brief Sends a fixed account operation without leaking passwords into errors.
 * @param cookie Session cookie.
 * @param path Fixed API path.
 * @param method HTTP method.
 * @param body Optional input.
 * @return Status and untrusted response.
 */
export async function accountRequest(
	cookie: string | null,
	path: string,
	method: string,
	body?: unknown
) {
	const headers: Record<string, string> = {
		origin: mutationOrigin(),
		'content-type': 'application/json'
	};
	if (cookie) {
		headers['cookie'] = cookie;
	}
	try {
		const response = await apiFetch(`${apiBase()}${path}`, {
			method,
			headers,
			body: body === undefined ? null : JSON.stringify(body),
			signal: AbortSignal.timeout(10_000)
		});
		return { status: response.status, data: (await response.json().catch(() => null)) as unknown };
	} catch {
		return { status: 503, data: null };
	}
}

/**
 * @brief Loads one administrator-only account page.
 * @param cookie Cookie.
 * @param offset Validated page offset.
 * @return Page or null during an outage.
 */
export async function listAccounts(cookie: string | null, offset: number) {
	const result = await accountRequest(cookie, `/api/admin/users?limit=25&offset=${offset}`, 'GET');
	const parsed = pageSchema.safeParse(result.data);
	return result.status === 200 && parsed.success ? parsed.data : null;
}

/**
 * @brief Presents only known generic failures, not raw upstream exceptions.
 * @param status Upstream status.
 * @return Safe feedback.
 */
export function accountError(status: number): string {
	if (status === 429) {
		return 'Too many attempts. Please retry later.';
	}
	if (status === 409) {
		return 'Account details unavailable, or this change would remove the last active administrator.';
	}
	if (status === 400) {
		return 'Check the fields and use a different password with at least 12 characters.';
	}
	if (status === 401 || status === 403) {
		return 'Sign in again with the required account permissions.';
	}
	return 'Account service unavailable. Please retry.';
}
