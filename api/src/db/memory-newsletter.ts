/**
 * @file memory-newsletter.ts
 * @brief Isolated consent and atomic newsletter queue model for offline tests.
 */
import { randomUUID } from 'node:crypto';
import type { NewsletterCampaign, NewsletterRepository, NewsletterStats, NewsletterSubscriber } from '../newsletter/repository.js';

type Delivery = { id: string; campaignId: string; subscriberId: string; status: keyof NewsletterStats };

class MemoryNewsletter implements NewsletterRepository {
	private subscribers = new Map<string, NewsletterSubscriber>();
	private campaigns = new Map<string, NewsletterCampaign>();
	private deliveries = new Map<string, Delivery>();

	/** @brief Records explicit consent with resend cooldown. @param input Consent. @return Whether accepted. */
	async request(input: NewsletterSubscriber) {
		const existing = [...this.subscribers.values()].find((row) => row.email === input.email);
		if (existing && (existing.confirmed || input.requestedAt.getTime() - existing.requestedAt.getTime() < 600000)) { return false; }
		const row = { ...input, id: existing?.id ?? input.id };
		this.subscribers.set(row.id, row);
		return true;
	}
	/** @brief Consumes a single-use expiring token. @param hash Digest. @param now Clock. @return Whether confirmed. */
	async confirm(hash: string, now: Date) {
		const row = [...this.subscribers.values()].find((item) => item.tokenHash === hash);
		if (!row || row.confirmed || !row.consentedAt || !row.confirmExpiresAt || row.confirmExpiresAt <= now) { return false; }
		this.subscribers.set(row.id, { ...row, confirmed: true, confirmExpiresAt: null });
		return true;
	}
	/** @brief Reads consent. @param id Subscriber. @return Row or null. */
	async find(id: string) { return this.subscribers.get(id) ?? null; }
	/** @brief Deletes consent and skips queued deliveries. @param id Subscriber. @return Completion. */
	async unsubscribe(id: string) {
		this.subscribers.delete(id);
		for (const row of this.deliveries.values()) {
			if (row.subscriberId === id && row.status === 'queued') { row.status = 'skipped'; }
		}
	}
	/** @brief Counts confirmed explicit consent. @return Count. */
	async countConfirmed() { return [...this.subscribers.values()].filter((row) => row.confirmed && row.consentedAt).length; }
	/** @brief Creates immutable draft content. @param row Draft. @return Completion. */
	async createCampaign(row: NewsletterCampaign) { this.campaigns.set(row.id, { ...row }); }
	/** @brief Lists latest campaigns. @return Campaigns. */
	async listCampaigns() { return [...this.campaigns.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 20); }
	/** @brief Reads a campaign. @param id Campaign. @return Row or null. */
	async findCampaign(id: string) { return this.campaigns.get(id) ?? null; }
	/** @brief Snapshots explicit opt-ins only once. @param id Campaign. @return Whether found. */
	async start(id: string) {
		const campaign = this.campaigns.get(id);
		if (!campaign) { return false; }
		if (campaign.status !== 'draft') { return true; }
		const rows = [...this.subscribers.values()].filter((row) => row.confirmed && row.consentedAt);
		if (rows.length > 1000) { throw new Error('newsletter recipient limit exceeded'); }
		campaign.status = 'sending';
		for (const row of rows) {
			const delivery = { id: randomUUID(), campaignId: id, subscriberId: row.id, status: 'queued' as const };
			this.deliveries.set(delivery.id, delivery);
		}
		return true;
	}
	/** @brief Claims five queued recipients atomically. @param id Campaign. @return Claims. */
	async claim(id: string) {
		const rows = [...this.deliveries.values()].filter((row) => row.campaignId === id && row.status === 'queued').slice(0, 5);
		for (const row of rows) { row.status = 'sending'; }
		return rows.map(({ id, subscriberId }) => ({ id, subscriberId }));
	}
	/** @brief Persists terminal delivery status. @param id Delivery. @param status Outcome. @return Completion. */
	async finish(id: string, status: 'sent' | 'failed' | 'skipped') {
		const row = this.deliveries.get(id);
		if (row) { row.status = status; }
	}
	/** @brief Counts queue outcomes and completes exhausted campaigns. @param id Campaign. @return Counts. */
	async stats(id: string) {
		const stats: NewsletterStats = { queued: 0, sending: 0, sent: 0, failed: 0, skipped: 0 };
		for (const row of this.deliveries.values()) { if (row.campaignId === id) { stats[row.status] += 1; } }
		const campaign = this.campaigns.get(id);
		if (campaign?.status === 'sending' && !stats.queued && !stats.sending) { campaign.status = 'complete'; }
		return stats;
	}
}

/** @brief Creates isolated newsletter persistence. @return Repository. */
export function createMemoryNewsletter(): NewsletterRepository { return new MemoryNewsletter(); }
