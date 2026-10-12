/**
 * @file security-api.ts
 * @brief Zod-validated second-factor and security-history transport.
 */
import { z } from 'zod';
import { accountRequest } from './account-api.js';

export const factorStatusSchema = z.object({ enabled: z.boolean(), available: z.boolean() });
export const enrollmentSchema = z.object({
	secret: z.string().regex(/^[A-Z2-7]{32}$/),
	ticket: z.string().min(1).max(2048)
});
const auditSchema = z.object({
	items: z
		.array(
			z.object({
				id: z.uuid(),
				action: z.enum([
					'user.created',
					'user.changed',
					'password.changed',
					'password.reset',
					'sessions.revoked',
					'totp.enabled',
					'totp.disabled',
					'posts.deleted',
					'comment.moderated',
					'comment.deleted'
				]),
				actorId: z.uuid().nullable(),
				targetId: z.uuid().nullable(),
				count: z.number().int().positive(),
				createdAt: z.iso.datetime({ offset: true })
			})
		)
		.max(50),
	hasMore: z.boolean()
});

/** @brief Loads safe factor state. @param cookie Session. @return State or null. */
export async function factorStatus(cookie: string | null) {
	const result = await accountRequest(cookie, '/api/auth/totp', 'GET');
	const parsed = factorStatusSchema.safeParse(result.data);
	return result.status === 200 && parsed.success ? parsed.data : null;
}

/** @brief Loads one protected history page. @param cookie Session. @param offset Bounded offset. @return Validated page or null. */
export async function auditPage(cookie: string | null, offset: number) {
	const result = await accountRequest(cookie, `/api/admin/audit?offset=${offset}`, 'GET');
	const parsed = auditSchema.safeParse(result.data);
	return result.status === 200 && parsed.success ? parsed.data : null;
}
