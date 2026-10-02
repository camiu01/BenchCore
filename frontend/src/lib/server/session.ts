/**
 * @file session.ts
 * @brief Validates API session responses before granting frontend admin access.
 */
import { z } from 'zod';
import { apiBase } from '../api.js';
import { apiFetch } from './transport.js';

export const sessionSchema = z.object({
	user: z
		.object({
			id: z.string().uuid(),
			email: z.string().email(),
			name: z.string(),
			role: z.enum(['admin', 'editor', 'reader'])
		})
		.nullable()
});

/**
 * @brief Resolves and validates the session cookie against the API.
 * @param cookie The browser Cookie header, if any.
 * @return The validated session user or null on invalid/unreachable responses.
 */
export async function resolveSessionUser(cookie: string | null): Promise<App.Locals['user']> {
	if (cookie === null) {
		return null;
	}
	try {
		const response = await apiFetch(`${apiBase()}/api/auth/me`, {
			headers: { cookie },
			signal: AbortSignal.timeout(5000)
		});
		if (!response.ok) {
			return null;
		}
		const result = sessionSchema.safeParse(await response.json());
		return result.success ? result.data.user : null;
	} catch {
		return null;
	}
}
