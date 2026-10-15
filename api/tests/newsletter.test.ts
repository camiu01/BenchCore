/**
 * @file newsletter.test.ts
 * @brief Offline double opt-in, expiry, revocation and duplicate-safe manual send regressions.
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryNewsletter } from '../src/db/memory-newsletter.js';
import { campaignSchema, confirmationSchema, confirmSubscription, createCampaign, sendBatch,
	sendSchema, subscribe, subscriptionSchema, unsubscribe, type NewsletterDeps } from '../src/newsletter/service.js';
import { configuredNewsletter } from '../src/newsletter/delivery.js';

/** @brief Creates fake mail delivery; never contacts SMTP. @return Dependencies and spies. */
function setup() {
	const confirmation = vi.fn(async (_email: string, _url: string) => undefined);
	const send = vi.fn(async (_email: string, _campaign: unknown, _url: string) => undefined);
	const deps: NewsletterDeps = { repository: createMemoryNewsletter(),
		mail: { delivery: { confirm: confirmation, send }, siteUrl: 'https://example.test', tokenKey: 'test-only-independent-secret-32-characters' } };
	return { deps, confirmation, send };
}
/** @brief Registers and confirms a fake subscriber. @param context Fake service. @param email Test recipient. @return Confirmation token. */
async function optIn(context: ReturnType<typeof setup>, email = 'reader@example.test') {
	await subscribe(context.deps, subscriptionSchema.parse({ email, consent: true }));
	const url = context.confirmation.mock.calls.at(-1)?.[1] ?? '';
	const token = new URL(url).searchParams.get('token') ?? '';
	expect(await confirmSubscription(context.deps, token)).toBe(true);
	return token;
}

describe('explicit newsletter consent', () => {
	it('requires a checked consent, rejects header injection and never enables mail implicitly', () => {
		expect(subscriptionSchema.safeParse({ email: 'reader@example.test' }).success).toBe(false);
		expect(subscriptionSchema.safeParse({ email: 'reader@example.test', consent: false }).success).toBe(false);
		expect(campaignSchema.safeParse({ subject: 'Hi\r\nBcc: victim@example.test', body: 'Text' }).success).toBe(false);
		expect(sendSchema.safeParse({ id: randomUUID(), confirmation: 'yes' }).success).toBe(false);
		expect(configuredNewsletter({ ZOHO_SMTP_USER: 'configured' })).toBeUndefined();
		expect(() => configuredNewsletter({ NEWSLETTER_ENABLED: 'true' })).toThrow();
	});
	it('confirms a hashed, expiring, single-use token without an account', async () => {
		const context = setup();
		const token = await optIn(context);
		expect(confirmationSchema.safeParse({ token }).success).toBe(true);
		expect(await confirmSubscription(context.deps, token)).toBe(false);
		expect(await context.deps.repository.countConfirmed()).toBe(1);
	});
	it('does not send newsletters to unconfirmed subscribers or send anything when saving a draft', async () => {
		const context = setup();
		await subscribe(context.deps, subscriptionSchema.parse({ email: 'reader@example.test', consent: true }));
		const campaign = await createCampaign(context.deps, randomUUID(), { subject: 'News', body: 'Preview' });
		expect(context.send).not.toHaveBeenCalled();
		expect(await sendBatch(context.deps, campaign.id)).toMatchObject({ sent: 0 });
		expect(context.send).not.toHaveBeenCalled();
	});
	it('rejects expired confirmations and throttles resends without revealing confirmed subscriptions', async () => {
		const context = setup();
		const input = subscriptionSchema.parse({ email: 'reader@example.test', consent: true });
		const now = new Date();
		await subscribe(context.deps, input, now);
		const token = new URL(context.confirmation.mock.calls[0]?.[1] ?? '').searchParams.get('token') ?? '';
		await subscribe(context.deps, input, now);
		expect(context.confirmation).toHaveBeenCalledTimes(1);
		expect(await confirmSubscription(context.deps, token, new Date(now.getTime() + 86400001))).toBe(false);
	});
	it('ignores honeypots and omits legacy subscriptions without recorded consent', async () => {
		const context = setup();
		await subscribe(context.deps, subscriptionSchema.parse({ email: 'bot@example.test', consent: true, website: 'spam' }));
		expect(context.confirmation).not.toHaveBeenCalled();
		await context.deps.repository.request({ id: randomUUID(), email: 'legacy@example.test', tokenHash: 'legacy',
			confirmed: true, consentedAt: null, confirmExpiresAt: null, requestedAt: new Date() });
		expect(await context.deps.repository.countConfirmed()).toBe(0);
	});
	it('sends separate five-recipient batches and does not duplicate concurrent or repeated sends', async () => {
		const context = setup();
		for (let i = 0; i < 7; i += 1) { await optIn(context, `reader${i}@example.test`); }
		const campaign = await createCampaign(context.deps, randomUUID(), { subject: 'News', body: 'Reviewed' });
		expect(await sendBatch(context.deps, campaign.id)).toMatchObject({ sent: 5, queued: 2 });
		await Promise.all([sendBatch(context.deps, campaign.id), sendBatch(context.deps, campaign.id)]);
		await sendBatch(context.deps, campaign.id);
		expect(context.send).toHaveBeenCalledTimes(7);
		expect(new Set(context.send.mock.calls.map(([email]) => email)).size).toBe(7);
	});
	it('unsubscribes without an account and rejects altered tokens', async () => {
		const context = setup();
		await optIn(context);
		const campaign = await createCampaign(context.deps, randomUUID(), { subject: 'News', body: 'Reviewed' });
		await sendBatch(context.deps, campaign.id);
		const token = new URL(context.send.mock.calls[0]?.[2] ?? '').searchParams.get('token') ?? '';
		expect(await unsubscribe(context.deps, `${token}x`)).toBe(false);
		expect(await unsubscribe(context.deps, token)).toBe(true);
		expect(await unsubscribe(context.deps, token)).toBe(true);
		expect(await context.deps.repository.countConfirmed()).toBe(0);
		const next = await createCampaign(context.deps, randomUUID(), { subject: 'Next', body: 'Reviewed' });
		expect(await sendBatch(context.deps, next.id)).toMatchObject({ sent: 0 });
	});
	it('records failures without automatic retries', async () => {
		const context = setup();
		await optIn(context);
		context.send.mockRejectedValue(new Error('fake delivery failure'));
		const campaign = await createCampaign(context.deps, randomUUID(), { subject: 'News', body: 'Reviewed' });
		expect(await sendBatch(context.deps, campaign.id)).toMatchObject({ failed: 1, sent: 0 });
		await sendBatch(context.deps, campaign.id);
		expect(context.send).toHaveBeenCalledTimes(1);
	});
});
