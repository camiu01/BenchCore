/**
 * @file +page.server.ts
 * @brief Authenticated account page and current-password-confirmed password changes.
 */
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { accountError, accountRequest } from '../../lib/server/account-api.js';
import type { Actions, PageServerLoad } from './$types';

/** @brief Exposes only the current session's public owner. @param event Session. @return Owner. */
export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	return { user: locals.user };
};

export const actions: Actions = {
	/** @brief Rotates the owner's password and clears the revoked cookie. @param event Form. @return Feedback or redirect. */
	password: async ({ request, cookies, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}
		const form = await request.formData();
		const parsed = z
			.object({
				currentPassword: z.string().min(1).max(200),
				newPassword: z.string().min(12).max(200)
			})
			.safeParse({
				currentPassword: form.get('currentPassword'),
				newPassword: form.get('newPassword')
			});
		if (!parsed.success || parsed.data.newPassword !== form.get('confirmation')) {
			return fail(400, { error: 'Use matching passwords with at least 12 characters.' });
		}
		const result = await accountRequest(
			request.headers.get('cookie'),
			'/api/auth/password',
			'POST',
			parsed.data
		);
		if (result.status !== 200) {
			return fail(result.status, { error: accountError(result.status) });
		}
		cookies.delete('session', { path: '/' });
		throw redirect(303, '/login?passwordChanged=1');
	}
};
