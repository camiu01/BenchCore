/**
 * @file repository.ts
 * @brief Persistence boundary for consent, single-use confirmations and durable send claims.
 */
export interface NewsletterSubscriber {
	id: string;
	email: string;
	tokenHash: string;
	confirmed: boolean;
	consentedAt: Date | null;
	confirmExpiresAt: Date | null;
	requestedAt: Date;
}
export interface NewsletterCampaign {
	id: string;
	subject: string;
	body: string;
	status: 'draft' | 'sending' | 'complete';
	authorId: string;
	createdAt: Date;
}
export interface NewsletterStats {
	queued: number;
	sending: number;
	sent: number;
	failed: number;
	skipped: number;
}
export interface NewsletterRepository {
	/** @brief Inserts/refreshes only unconfirmed consent after cooldown. @param input Subscriber consent. @return Whether delivery is allowed. */
	request(input: NewsletterSubscriber): Promise<boolean>;
	/** @brief Atomically consumes an unexpired confirmation. @param hash Token digest. @param now Clock. @return Whether confirmed. */
	confirm(hash: string, now: Date): Promise<boolean>;
	/** @brief Finds a subscriber immediately before delivery. @param id Subscriber. @return Subscriber or null. */
	find(id: string): Promise<NewsletterSubscriber | null>;
	/** @brief Deletes consent and prevents queued future sends. @param id Subscriber. @return Completion. */
	unsubscribe(id: string): Promise<void>;
	/** @brief Counts only confirmed explicit opt-ins. @return Count. */
	countConfirmed(): Promise<number>;
	/** @brief Saves an immutable draft. @param input Draft. @return Completion. */
	createCampaign(input: NewsletterCampaign): Promise<void>;
	/** @brief Lists the latest bounded campaigns. @return Drafts and sent campaigns. */
	listCampaigns(): Promise<NewsletterCampaign[]>;
	/** @brief Finds immutable campaign content. @param id Campaign. @return Campaign or null. */
	findCampaign(id: string): Promise<NewsletterCampaign | null>;
	/** @brief Atomically snapshots up to 1000 opted-in recipients once. @param id Campaign. @return Whether campaign exists. */
	start(id: string): Promise<boolean>;
	/** @brief Claims at most five recipients without duplicate concurrent sends. @param id Campaign. @return Delivery and subscriber IDs. */
	claim(id: string): Promise<{ id: string; subscriberId: string }[]>;
	/** @brief Persists a terminal outcome; in-flight claims are never automatically retried. @param id Delivery. @param status Outcome. @return Completion. */
	finish(id: string, status: 'sent' | 'failed' | 'skipped'): Promise<void>;
	/** @brief Returns bounded delivery counts and completes exhausted campaigns. @param id Campaign. @return Counts. */
	stats(id: string): Promise<NewsletterStats>;
}
