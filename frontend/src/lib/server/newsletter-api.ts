/**
 * @file newsletter-api.ts
 * @brief Validated newsletter transport without exposing subscriber addresses.
 */
import { z } from 'zod';
import { apiBase } from '../api.js';
import { mutationOrigin } from '../site.js';
import { apiFetch } from './transport.js';

const statsSchema = z.object({
	queued: z.number().int().nonnegative(), sending: z.number().int().nonnegative(),
	sent: z.number().int().nonnegative(), failed: z.number().int().nonnegative(), skipped: z.number().int().nonnegative()
});
const dashboardSchema = z.object({
	enabled: z.boolean(), confirmed: z.number().int().nonnegative(),
	items: z.array(z.object({
		id: z.uuid(), subject: z.string(), body: z.string(),
		status: z.enum(['draft', 'sending', 'complete']), stats: statsSchema
	})).max(20)
});

/** @brief Checks whether opt-in delivery is configured. @return Availability. */
export async function newsletterEnabled() {
	try {
		const response = await apiFetch(`${apiBase()}/api/newsletter`, { signal: AbortSignal.timeout(5000) });
		const parsed = z.object({ enabled: z.boolean() }).safeParse(await response.json());
		return response.ok && parsed.success && parsed.data.enabled;
	} catch { return false; }
}

/** @brief Loads admin campaign previews and anonymous counts. @param cookie Session. @return Dashboard or null. */
export async function newsletterDashboard(cookie: string | null) {
	try {
		const response = await apiFetch(`${apiBase()}/api/admin/newsletter`, {
			headers: { cookie: cookie ?? '' }, signal: AbortSignal.timeout(5000)
		});
		if (!response.ok) { return null; }
		const parsed = dashboardSchema.safeParse(await response.json());
		return parsed.success ? parsed.data : null;
	} catch { return null; }
}

/** @brief Sends a fixed newsletter mutation with a trusted Origin. @param action Allowlisted operation. @param body Input. @param cookie Optional admin session. @return Whether accepted. */
export async function newsletterMutation(action: 'subscribe' | 'confirm' | 'unsubscribe' | 'draft' | 'send',
	body: unknown, cookie: string | null = null) {
	const paths = { subscribe: '/api/newsletter/subscribe', confirm: '/api/newsletter/confirm',
		unsubscribe: '/api/newsletter/unsubscribe', draft: '/api/admin/newsletter', send: '/api/admin/newsletter/send' };
	try {
		const response = await apiFetch(`${apiBase()}${paths[action]}`, {
			method: 'POST', headers: { cookie: cookie ?? '', origin: mutationOrigin(), 'content-type': 'application/json' },
			body: JSON.stringify(body), signal: AbortSignal.timeout(action === 'send' ? 60000 : 20000)
		});
		return response.ok;
	} catch { return false; }
}
