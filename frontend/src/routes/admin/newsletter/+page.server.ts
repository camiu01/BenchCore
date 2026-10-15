/**
 * @file +page.server.ts
 * @brief Newsletter drafts and explicit, bounded manual send actions.
 */
import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { newsletterDashboard, newsletterMutation } from '../../../lib/server/newsletter-api.js';
import type { Actions, PageServerLoad } from './$types';

/** @brief Loads content previews and counts, never subscriber email addresses. @param event Admin session. @return Dashboard. */
export const load: PageServerLoad = async ({ request }) => ({ dashboard: await newsletterDashboard(request.headers.get('cookie')) });

export const actions: Actions = {
	/** @brief Saves preview content without sending any messages. @param event Draft form. @return Outcome. */
	draft: async ({ request }) => {
		const form = await request.formData();
		const parsed = z.object({ subject: z.string().trim().min(1).max(200),
			body: z.string().trim().min(1).max(20000) }).safeParse(Object.fromEntries(form));
		if (!parsed.success) { return fail(400, { ok: false, values: null }); }
		const ok = await newsletterMutation('draft', parsed.data, request.headers.get('cookie'));
		return ok ? { ok: true, values: null } : fail(502, { ok: false, values: parsed.data });
	},
	/** @brief Requires an unchecked approval box and typed SEND for every five-recipient batch. @param event Approval form. @return Outcome. */
	send: async ({ request }) => {
		const form = await request.formData();
		const parsed = z.object({ id: z.uuid(), confirmation: z.literal('SEND'), approved: z.literal('yes') })
			.safeParse(Object.fromEntries(form));
		if (!parsed.success) { return fail(400, { ok: false, values: null }); }
		const ok = await newsletterMutation('send', { id: parsed.data.id, confirmation: parsed.data.confirmation }, request.headers.get('cookie'));
		return ok ? { ok: true, values: null } : fail(502, { ok: false, values: null });
	}
};
