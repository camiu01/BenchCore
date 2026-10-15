/**
 * @file newsletter.ts
 * @brief Validated consent endpoints and administrator-only manual newsletter controls.
 */
import { requireUser } from './auth.js';
import { readBody, sendJson } from './response.js';
import type { ApiHandler } from './types.js';
import { campaignSchema, confirmationSchema, confirmSubscription, createCampaign,
	sendBatch, sendSchema, subscribe, subscriptionSchema, unsubscribe, unsubscribeSchema } from '../newsletter/service.js';

/** @brief Reports public newsletter availability, without subscriber data. @param req Request. @param res Response. @param deps Dependencies. @return Completion. */
export const handleNewsletterStatus: ApiHandler = async (_req, res, deps) => {
	sendJson(res, 200, { enabled: Boolean(deps.newsletter?.mail) });
};

/** @brief Validates explicit consent, confirmation or revocation. @param req Request. @param res Response. @param deps Dependencies. @param url Route. @return Completion. */
export const handleNewsletterConsent: ApiHandler = async (req, res, deps, url) => {
	const newsletter = deps.newsletter;
	if (!newsletter?.mail) { sendJson(res, 503, { error: 'unavailable' }); return; }
	const body = await readBody(req, res);
	if (!body) { return; }
	if (url.pathname.endsWith('/subscribe')) {
		const parsed = subscriptionSchema.safeParse(body.data);
		if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
		try { await subscribe(newsletter, parsed.data); } catch { /* Keep subscriber existence and delivery failures private. */ }
		sendJson(res, 202, { accepted: true });
		return;
	}
	const confirming = url.pathname.endsWith('/confirm');
	const parsed = (confirming ? confirmationSchema : unsubscribeSchema).safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
	const accepted = confirming ? await confirmSubscription(newsletter, parsed.data.token)
		: await unsubscribe(newsletter, parsed.data.token);
	sendJson(res, accepted ? 200 : 400, { accepted });
};

/** @brief Loads previews or creates a draft, never sending on creation. @param req Request. @param res Response. @param deps Dependencies. @return Completion. */
export const handleNewsletterAdmin: ApiHandler = async (req, res, deps) => {
	const user = await requireUser(req, res, deps);
	if (!user) { return; }
	const newsletter = deps.newsletter;
	if (!newsletter) { sendJson(res, 503, { error: 'unavailable' }); return; }
	if (req.method === 'GET') {
		const campaigns = await newsletter.repository.listCampaigns();
		const items = await Promise.all(campaigns.map(async (campaign) => ({
			...campaign, stats: await newsletter.repository.stats(campaign.id)
		})));
		sendJson(res, 200, { items, confirmed: await newsletter.repository.countConfirmed(), enabled: Boolean(newsletter.mail) });
		return;
	}
	const body = await readBody(req, res);
	if (!body) { return; }
	const parsed = campaignSchema.safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
	sendJson(res, 201, await createCampaign(newsletter, user.id, parsed.data));
};

/** @brief Requires typed SEND approval before each bounded batch. @param req Request. @param res Response. @param deps Dependencies. @return Completion. */
export const handleNewsletterSend: ApiHandler = async (req, res, deps) => {
	if (!await requireUser(req, res, deps)) { return; }
	if (!deps.newsletter?.mail) { sendJson(res, 503, { error: 'unavailable' }); return; }
	const body = await readBody(req, res);
	if (!body) { return; }
	const parsed = sendSchema.safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
	const stats = await sendBatch(deps.newsletter, parsed.data.id);
	sendJson(res, stats ? 200 : 404, stats ?? { error: 'not_found' });
};
