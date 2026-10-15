/**
 * @file +page.server.ts
 * @brief Non-mutating email link landing pages; consent changes require an explicit POST.
 */
import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { newsletterMutation } from '../../../lib/server/newsletter-api.js';
import type { Actions, PageServerLoad } from './$types';

const actionSchema = z.enum(['confirm', 'unsubscribe']);
const tokenSchema = z.string().regex(/^[A-Za-z0-9_.-]{43,100}$/);

/** @brief Shows a confirmation button without consuming email links on GET. @param event Token URL. @return Allowlisted action and token. */
export const load: PageServerLoad = async ({ params, url, setHeaders }) => {
	const action = actionSchema.safeParse(params.action);
	if (!action.success) {
		throw error(404);
	}
	setHeaders({
		'cache-control': 'no-store',
		'referrer-policy': 'no-referrer',
		'x-robots-tag': 'noindex'
	});
	const token = tokenSchema.safeParse(url.searchParams.get('token'));
	return { action: action.data, token: token.success ? token.data : '' };
};

export const actions: Actions = {
	/** @brief Applies confirmation or revocation only after the reader presses the button. @param event Form. @return Safe result. */
	default: async ({ params, request }) => {
		const action = actionSchema.safeParse(params.action);
		const token = tokenSchema.safeParse((await request.formData()).get('token'));
		if (!action.success || !token.success) {
			return fail(400, { accepted: false });
		}
		const accepted = await newsletterMutation(action.data, { token: token.data });
		return accepted ? { accepted: true } : fail(400, { accepted: false });
	}
};
