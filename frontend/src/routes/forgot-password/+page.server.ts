/**
 * @file +page.server.ts
 * @brief Public password recovery request form with account-enumeration-safe feedback.
 */
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { accountRequest } from '../../lib/server/account-api.js';
import { serverT } from '../../lib/server/server-t.js';
import type { Actions, PageServerLoad } from './$types';

/** @brief Keeps authenticated owners in their account area. @param event Session. @return Empty page data. */
export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/account');
	}
	return {};
};

export const actions: Actions = {
	/** @brief Requests an email without revealing whether the address exists. @param event Form request. @return Generic feedback. */
	default: async ({ request }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const parsed = z.email().max(254).safeParse(email);
		if (!parsed.success) {
			return fail(400, { error: serverT('auth.forgot.error.invalidEmail'), email });
		}
		const result = await accountRequest(null, '/api/auth/password/forgot', 'POST', {
			email: parsed.data
		});
		if (result.status === 429) {
			return fail(429, { error: serverT('auth.error.rateLimited'), email });
		}
		if (result.status !== 202) {
			return fail(503, { error: serverT('auth.forgot.error.unavailable'), email });
		}
		return { success: true };
	}
};
