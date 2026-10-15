/**
 * @file drizzle-newsletter.ts
 * @brief PostgreSQL consent and concurrency-safe newsletter send queue.
 */
import { randomUUID } from 'node:crypto';
import { and, count, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { AppDb } from './client.js';
import { subscribers } from './schema.js';
import { newsletterCampaigns as campaigns, newsletterDeliveries as deliveries } from './newsletter-schema.js';
import type { NewsletterCampaign, NewsletterRepository, NewsletterStats, NewsletterSubscriber } from '../newsletter/repository.js';

/** @brief Selects only confirmed, explicitly consented subscribers. @return SQL predicate. */
function optedIn() { return and(eq(subscribers.confirmed, true), isNotNull(subscribers.consentedAt)); }

class DrizzleNewsletter implements NewsletterRepository {
		/** @brief Retains the SQL client. @param db Database. */
		constructor(private readonly db: AppDb) {}
		/** @brief Records consent with a ten-minute resend cooldown. @param input Consent. @return Whether accepted. */
		async request(input: NewsletterSubscriber) {
			const fields = { email: input.email, tokenHash: input.tokenHash, confirmed: false,
				consentedAt: input.consentedAt, confirmExpiresAt: input.confirmExpiresAt, requestedAt: input.requestedAt };
			const rows = await this.db.insert(subscribers).values(input).onConflictDoUpdate({
				target: subscribers.email, set: fields,
				setWhere: sql`${subscribers.confirmed} = false and ${subscribers.requestedAt} <= ${new Date(input.requestedAt.getTime() - 600_000)}`
			}).returning({ id: subscribers.id });
			return rows.length > 0;
		}
		/** @brief Consumes a single-use expiring token. @param hash Digest. @param now Clock. @return Whether confirmed. */
		async confirm(hash: string, now: Date) {
			const rows = await this.db.update(subscribers).set({ confirmed: true, confirmExpiresAt: null })
				.where(and(eq(subscribers.tokenHash, hash), eq(subscribers.confirmed, false),
					isNotNull(subscribers.consentedAt), sql`${subscribers.confirmExpiresAt} > ${now}`)).returning({ id: subscribers.id });
			return rows.length > 0;
		}
		/** @brief Loads current recipient consent. @param id Subscriber. @return Row or null. */
		async find(id: string) { return (await this.db.select().from(subscribers).where(eq(subscribers.id, id)).limit(1))[0] ?? null; }
		/** @brief Removes subscriber data and skips queued deliveries atomically. @param id Subscriber. @return Completion. */
		async unsubscribe(id: string) {
			await this.db.transaction(async (tx) => {
				await tx.delete(subscribers).where(eq(subscribers.id, id));
				await tx.update(deliveries).set({ status: 'skipped' }).where(and(eq(deliveries.subscriberId, id), eq(deliveries.status, 'queued')));
			});
		}
		/** @brief Counts explicit confirmed opt-ins. @return Count. */
		async countConfirmed() { return (await this.db.select({ value: count() }).from(subscribers).where(optedIn()))[0]?.value ?? 0; }
		/** @brief Saves a draft. @param input Campaign. @return Completion. */
		async createCampaign(input: NewsletterCampaign) { await this.db.insert(campaigns).values(input); }
		/** @brief Lists the latest twenty campaigns. @return Campaigns. */
		async listCampaigns() { return this.db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(20); }
		/** @brief Finds a campaign. @param id Campaign. @return Row or null. */
		async findCampaign(id: string) { return (await this.db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1))[0] ?? null; }
		/** @brief Snapshots consent once under an atomic draft transition. @param id Campaign. @return Whether found. */
		async start(id: string) {
			return this.db.transaction(async (tx) => {
				const rows = await tx.update(campaigns).set({ status: 'sending' })
					.where(and(eq(campaigns.id, id), eq(campaigns.status, 'draft'))).returning({ id: campaigns.id });
				if (!rows.length) { return (await tx.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, id))).length > 0; }
				const recipients = await tx.select({ id: subscribers.id }).from(subscribers).where(optedIn()).limit(1001);
				if (recipients.length > 1000) { throw new Error('newsletter recipient limit exceeded'); }
				if (recipients.length) {
					await tx.insert(deliveries).values(recipients.map((recipient) =>
						({ id: randomUUID(), campaignId: id, subscriberId: recipient.id })));
				}
				return true;
			});
		}
		/** @brief Claims a bounded queue batch using row locks. @param id Campaign. @return Claimed recipient IDs. */
		async claim(id: string) {
			return this.db.transaction(async (tx) => {
				const rows = await tx.select({ id: deliveries.id, subscriberId: deliveries.subscriberId })
					.from(deliveries).where(and(eq(deliveries.campaignId, id), eq(deliveries.status, 'queued')))
					.orderBy(deliveries.id).limit(5).for('update', { skipLocked: true });
				if (rows.length) { await tx.update(deliveries).set({ status: 'sending' }).where(inArray(deliveries.id, rows.map((row) => row.id))); }
				return rows;
			});
		}
		/** @brief Persists a terminal delivery outcome. @param id Delivery. @param status Outcome. @return Completion. */
		async finish(id: string, status: 'sent' | 'failed' | 'skipped') { await this.db.update(deliveries).set({ status }).where(eq(deliveries.id, id)); }
		/** @brief Counts outcomes and completes exhausted queues. @param id Campaign. @return Counters. */
		async stats(id: string) {
			const rows = await this.db.select({ status: deliveries.status, value: count() }).from(deliveries)
				.where(eq(deliveries.campaignId, id)).groupBy(deliveries.status);
			const stats: NewsletterStats = { queued: 0, sending: 0, sent: 0, failed: 0, skipped: 0 };
			for (const row of rows) { stats[row.status] = row.value; }
			if (!stats.queued && !stats.sending) {
				await this.db.update(campaigns).set({ status: 'complete' }).where(and(eq(campaigns.id, id), eq(campaigns.status, 'sending')));
			}
			return stats;
		}
}

/** @brief Creates the durable newsletter repository. @param db Database. @return Repository. */
export function createDrizzleNewsletter(db: AppDb): NewsletterRepository { return new DrizzleNewsletter(db); }
