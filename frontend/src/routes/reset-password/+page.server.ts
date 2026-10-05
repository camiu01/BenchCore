/**
 * @file +page.server.ts
 * @brief Public single-use password reset form.
 */
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { accountRequest } from '../../lib/server/account-api.js';
import type { Actions, PageServerLoad } from './$types';

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** @brief Validates the URL token without contacting persistence. @param event URL and session. @return Safe token state. */
export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) {
		throw redirect(303, '/account');
	}
	const parsed = tokenSchema.safeParse(url.searchParams.get('token'));
	return { token: parsed.success ? parsed.data : null };
};

export const actions: Actions = {
	/** @brief Submits a matching new password with the opaque reset token. @param event Form request. @return Failure or login redirect. */
	default: async ({ request }) => {
		const form = await request.formData();
		const parsed = z
			.object({
				token: tokenSchema,
				newPassword: z.string().min(8).max(200),
				confirmation: z.string().min(8).max(200)
			})
			.safeParse(Object.fromEntries(form));
		if (!parsed.success || parsed.data.newPassword !== parsed.data.confirmation) {
			return fail(400, { error: 'Use matching passwords with at least 8 characters.' });
		}
		const result = await accountRequest(null, '/api/auth/password/reset', 'POST', {
			token: parsed.data.token,
			newPassword: parsed.data.newPassword
		});
		if (result.status !== 200) {
			return fail(result.status === 429 ? 429 : 400, {
				error:
					result.status === 429
						? 'Too many attempts. Please retry later.'
						: 'This reset link is invalid or expired. Request a new one.'
			});
		}
		throw redirect(303, '/login?passwordReset=1');
	}
};
