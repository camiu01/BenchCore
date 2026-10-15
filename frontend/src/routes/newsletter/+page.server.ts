/**
 * @file +page.server.ts
 * @brief Account-independent newsletter consent with no default or implicit opt-in.
 */
import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { newsletterEnabled, newsletterMutation } from '../../lib/server/newsletter-api.js';
import type { Actions, PageServerLoad } from './$types';

/** @brief Loads delivery availability. @return Availability. */
export const load: PageServerLoad = async () => ({ enabled: await newsletterEnabled() });

export const actions: Actions = {
	/** @brief Requires explicit consent before requesting a confirmation email. @param event Form. @return Generic response without subscriber enumeration. */
	default: async ({ request }) => {
		const form = await request.formData();
		const parsed = z.object({
			email: z.string().trim().email().max(254), consent: z.literal('yes'), website: z.string().max(200)
		}).safeParse({ email: form.get('email'), consent: form.get('consent'), website: form.get('website') ?? '' });
		if (!parsed.success) { return fail(400, { accepted: false }); }
		const accepted = await newsletterMutation('subscribe', { ...parsed.data, consent: true });
		return accepted ? { accepted: true } : fail(503, { accepted: false });
	}
};
