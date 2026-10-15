/**
 * @file service.ts
 * @brief Explicit double opt-in and manually confirmed, bounded newsletter delivery.
 */
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { NewsletterCampaign, NewsletterRepository } from './repository.js';

export interface NewsletterDelivery {
	/** @brief Sends an individual confirmation email. @param email Recipient. @param url Confirmation URL. @return Completion. */
	confirm(email: string, url: string): Promise<void>;
	/** @brief Sends one manually approved newsletter. @param email Recipient. @param campaign Content. @param unsubscribeUrl Consent revocation URL. @return Completion. */
	send(email: string, campaign: NewsletterCampaign, unsubscribeUrl: string): Promise<void>;
}
export interface NewsletterDeps {
	repository: NewsletterRepository;
	mail?: { delivery: NewsletterDelivery; siteUrl: string; tokenKey: string };
}
export const subscriptionSchema = z.object({
	email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
	consent: z.literal(true),
	website: z.string().max(200).default('')
}).strict();
export const campaignSchema = z.object({
	subject: z.string().trim().min(1).max(200).refine((value) => !/[\r\n]/.test(value)),
	body: z.string().trim().min(1).max(20000)
}).strict();
export const confirmationSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
export const unsubscribeSchema = z.object({ token: z.string().max(100) }).strict();
export const sendSchema = z.object({ id: z.string().uuid(), confirmation: z.literal('SEND') }).strict();

/** @brief Digests a confirmation token at rest. @param token Secret. @return SHA-256 digest. */
function digest(token: string) { return createHash('sha256').update(token).digest('hex'); }

/** @brief Signs a stable per-consent revocation token. @param id Subscriber UUID. @param key Dedicated secret. @return Signature. */
function signature(id: string, key: string) {
	return createHmac('sha256', key).update(`newsletter-unsubscribe:${id}`).digest('base64url');
}

/** @brief Requests opt-in without revealing existing subscriptions. @param deps Dependencies. @param input Validated explicit consent. @param now Clock. @return Completion. */
export async function subscribe(deps: NewsletterDeps, input: z.infer<typeof subscriptionSchema>, now = new Date()) {
	if (!deps.mail) { throw new Error('newsletter disabled'); }
	if (input.website) { return; }
	const token = randomBytes(32).toString('base64url');
	const accepted = await deps.repository.request({
		id: randomUUID(), email: input.email, tokenHash: digest(token), confirmed: false,
		consentedAt: now, requestedAt: now, confirmExpiresAt: new Date(now.getTime() + 86400_000)
	});
	if (!accepted) { return; }
	await deps.mail.delivery.confirm(input.email, `${deps.mail.siteUrl}/newsletter/confirm?token=${token}`);
}

/** @brief Consumes an unexpired confirmation without any account requirement. @param deps Dependencies. @param token Secret. @param now Clock. @return Whether accepted. */
export async function confirmSubscription(deps: NewsletterDeps, token: string, now = new Date()) {
	return deps.repository.confirm(digest(token), now);
}

/** @brief Revokes a signed subscription without exposing whether it existed. @param deps Dependencies. @param token Signed UUID. @return Whether token is valid. */
export async function unsubscribe(deps: NewsletterDeps, token: string) {
	if (!deps.mail) { return false; }
	const [id, supplied, extra] = token.split('.');
	if (extra !== undefined || !z.string().uuid().safeParse(id).success || !id || !supplied) { return false; }
	const expected = Buffer.from(signature(id, deps.mail.tokenKey));
	const actual = Buffer.from(supplied);
	if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) { return false; }
	await deps.repository.unsubscribe(id);
	return true;
}

/** @brief Persists a preview-only draft without sending. @param deps Dependencies. @param authorId Admin. @param input Content. @return Saved draft. */
export async function createCampaign(deps: NewsletterDeps, authorId: string, input: z.infer<typeof campaignSchema>) {
	const row: NewsletterCampaign = { ...input, id: randomUUID(), authorId, status: 'draft', createdAt: new Date() };
	await deps.repository.createCampaign(row);
	return row;
}

/** @brief Sends only a claimed recipient who still has confirmed consent. @param deps Dependencies. @param campaign Immutable content. @param claim Delivery claim. @return Completion. */
async function deliver(deps: NewsletterDeps, campaign: NewsletterCampaign, claim: { id: string; subscriberId: string }) {
	const mail = deps.mail;
	if (!mail) { return; }
	const subscriber = await deps.repository.find(claim.subscriberId);
	if (!subscriber?.confirmed || !subscriber.consentedAt) { await deps.repository.finish(claim.id, 'skipped'); return; }
	try {
		const token = `${subscriber.id}.${signature(subscriber.id, mail.tokenKey)}`;
		await mail.delivery.send(subscriber.email, campaign, `${mail.siteUrl}/newsletter/unsubscribe?token=${token}`);
		await deps.repository.finish(claim.id, 'sent');
	} catch {
		await deps.repository.finish(claim.id, 'failed');
	}
}

/** @brief Sends at most five recipients per explicit admin action, never automatically retries claims. @param deps Dependencies. @param id Campaign. @return Counts or null. */
export async function sendBatch(deps: NewsletterDeps, id: string) {
	if (!deps.mail) { throw new Error('newsletter disabled'); }
	const campaign = await deps.repository.findCampaign(id);
	if (!campaign || !await deps.repository.start(id)) { return null; }
	const claims = await deps.repository.claim(id);
	await Promise.all(claims.map((claim) => deliver(deps, campaign, claim)));
	return deps.repository.stats(id);
}
