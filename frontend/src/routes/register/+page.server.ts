/**
 * @file +page.server.ts
 * @brief Public reader registration without role selection or password reflection.
 */
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { accountError, accountRequest } from '../../lib/server/account-api.js';
import { serverT } from '../../lib/server/server-t.js';
import type { Actions } from './$types';

export const actions: Actions = {
	/** @brief Creates only a reader. @param event Form event. @return Feedback or redirect. */
	register: async ({ request }) => {
		const form = await request.formData();
		const fields = {
			username: String(form.get('username') ?? ''),
			email: String(form.get('email') ?? ''),
			name: String(form.get('name') ?? '')
		};
		const password = form.get('password');
		const parsed = z
			.object({
				username: z
					.string()
					.trim()
					.regex(/^[a-z][a-z0-9_-]{2,31}$/i),
				email: z.email().max(254),
				name: z.string().trim().min(1).max(200),
				password: z.string().min(8).max(200)
			})
			.safeParse({ ...fields, password });
		if (!parsed.success || password !== form.get('confirmation')) {
			return fail(400, {
				error: serverT('auth.register.error.invalid'),
				...fields
			});
		}
		const result = await accountRequest(null, '/api/auth/register', 'POST', parsed.data);
		if (result.status !== 201) {
			return fail(result.status, { error: accountError(result.status), ...fields });
		}
		throw redirect(303, '/login?registered=1');
	}
};
