/**
 * @file backup-postgres-fixture.ts
 * @brief Complete relational recovery fixture, used only after empty loopback test-database guards.
 */
import { randomUUID } from 'node:crypto';
import type { AppDb } from '../src/db/client.js';
import * as tables from '../src/db/schema.js';
import { hashPassword } from '../src/auth/password.js';

const future = new Date('2099-01-01T00:00:00Z');
const imageData = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);
export const recoveryImage = {
	key: `${'a'.repeat(32)}.png`,
	filename: 'fixture.png',
	mime: 'image/png',
	sizeBytes: imageData.length,
	data: imageData
};

interface FixtureIds {
	userId: string;
	postId: string;
	tagId: string;
	subscriberId: string;
	campaignId: string;
}

/** @brief Seeds private content with preserved author/tag/media relationships. @param db Test database. @param ids Fixture identifiers. @return Completion. */
async function seedContent(db: AppDb, { userId, postId, tagId }: FixtureIds): Promise<void> {
	await db.insert(tables.users).values({
		id: userId,
		email: 'recovery@example.invalid',
		username: 'recovery',
		name: 'Recovery fixture',
		role: 'admin',
		passwordHash: await hashPassword('test-only-recovery-password')
	});
	await db.insert(tables.posts).values({
		id: postId,
		slug: 'recovery-fixture',
		title: 'Private recovery',
		contentMarkdown: 'Private fixture',
		contentHtml: '<p>Private fixture</p>',
		authorId: userId,
		status: 'draft',
		audience: 'readers',
		category: 'Recovery',
		coverImage: `/api/media/${recoveryImage.key}`,
		publishAt: future
	});
	await db.insert(tables.tags).values({ id: tagId, slug: 'recovery', name: 'Recovery' });
	await db.insert(tables.postTags).values({ postId, tagId });
}

/** @brief Seeds opaque security state and unused API-token groundwork. @param db Test database. @param ids Fixture identifiers. @return Completion. */
async function seedSecurity(db: AppDb, { userId, postId }: FixtureIds): Promise<void> {
	await db
		.insert(tables.sessions)
		.values({ id: randomUUID(), userId, tokenHash: 'fixture-session-hash', expiresAt: future });
	await db
		.insert(tables.passwordResetTokens)
		.values({ id: randomUUID(), userId, tokenHash: 'fixture-reset-hash', expiresAt: future });
	await db
		.insert(tables.administratorTotp)
		.values({ userId, sealedSecret: 'opaque-test-fixture', lastStep: 42 });
	await db
		.insert(tables.securityEvents)
		.values({ id: randomUUID(), action: 'recovery.fixture', actorId: userId, targetId: postId });
	await db.insert(tables.apiTokens).values({
		id: randomUUID(),
		userId,
		name: 'Groundwork',
		tokenHash: 'fixture-api-hash'
	});
}

/** @brief Seeds moderation, aggregate engagement and revision groundwork. @param db Test database. @param ids Fixture identifiers. @return Completion. */
async function seedDiscussion(db: AppDb, { postId }: FixtureIds): Promise<void> {
	await db
		.insert(tables.comments)
		.values({ id: randomUUID(), postId, authorName: 'Fixture', content: 'Pending fixture' });
	await db.insert(tables.likes).values({ postId, voterHash: 'fixture-voter-hash' });
	await db.insert(tables.pageViews).values({ postId, day: '2026-01-01', views: 7 });
	await db.insert(tables.revisions).values({
		id: randomUUID(),
		postId,
		title: 'Old title',
		contentMarkdown: 'Earlier fixture',
		contentHtml: '<p>Earlier fixture</p>'
	});
}

/** @brief Seeds opt-in and durable send claims without invoking mail delivery. @param db Test database. @param ids Fixture identifiers. @return Completion. */
async function seedNewsletter(
	db: AppDb,
	{ userId, subscriberId, campaignId }: FixtureIds
): Promise<void> {
	await db.insert(tables.subscribers).values({
		id: subscriberId,
		email: 'subscriber@example.invalid',
		tokenHash: 'fixture-confirmation-hash',
		confirmed: true,
		consentedAt: new Date(),
		confirmExpiresAt: future
	});
	await db
		.insert(tables.newsletterCampaigns)
		.values({ id: campaignId, authorId: userId, subject: 'Fixture', body: 'Not for delivery' });
	await db
		.insert(tables.newsletterDeliveries)
		.values({ id: randomUUID(), campaignId, subscriberId, status: 'sent' });
}

/** @brief Populates every application table, including inactive groundwork and security state. @param db Empty migrated test database. @return Completion. */
export async function seedRecoveryFixture(db: AppDb): Promise<void> {
	const ids = {
		userId: randomUUID(),
		postId: randomUUID(),
		tagId: randomUUID(),
		subscriberId: randomUUID(),
		campaignId: randomUUID()
	};
	await seedContent(db, ids);
	await seedSecurity(db, ids);
	await seedDiscussion(db, ids);
	await seedNewsletter(db, ids);
	await db.insert(tables.mediaBlobs).values(recoveryImage);
}
