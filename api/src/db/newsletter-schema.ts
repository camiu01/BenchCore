/**
 * @file newsletter-schema.ts
 * @brief Durable manual newsletter campaigns and recipient-level delivery claims.
 */
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const newsletterCampaigns = pgTable('newsletter_campaigns', {
	id: uuid('id').primaryKey(),
	subject: text('subject').notNull(),
	body: text('body').notNull(),
	status: text('status', { enum: ['draft', 'sending', 'complete'] }).notNull().default('draft'),
	authorId: uuid('author_id').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const newsletterDeliveries = pgTable('newsletter_deliveries', {
	id: uuid('id').primaryKey(),
	campaignId: uuid('campaign_id').notNull().references(() => newsletterCampaigns.id, { onDelete: 'cascade' }),
	subscriberId: uuid('subscriber_id').notNull(),
	status: text('status', { enum: ['queued', 'sending', 'sent', 'failed', 'skipped'] }).notNull().default('queued')
}, (table) => [
	uniqueIndex('newsletter_delivery_recipient_idx').on(table.campaignId, table.subscriberId),
	index('newsletter_delivery_queue_idx').on(table.campaignId, table.status)
]);
