/**
 * @file drizzle-security.ts
 * @brief Transactional second factors, security history and bounded post deletion.
 */
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { AppDb } from './client.js';
import { administratorTotp, posts, securityEvents, sessions, users } from './schema.js';
import type { SecurityAction, SecurityEvent, SecurityEventInput, SecurityRepository } from './security-repository.js';

/** @brief SQL-backed security operations. */
class DrizzleSecurity implements SecurityRepository {
	/** @brief Retains persistence. @param db Database. @return Repository instance. */
	constructor(private readonly db: AppDb) {}
	/** @brief Appends one safe event. @param event Fields. @return Completion. */
	async record(event: SecurityEventInput) {
		await this.db.insert(securityEvents).values({ id: randomUUID(), ...event });
	}
	/** @brief Lists newest events. @param offset Offset. @return Bounded page. */
	async listEvents(offset: number): Promise<SecurityEvent[]> {
		const rows = await this.db.select().from(securityEvents)
			.orderBy(desc(securityEvents.createdAt), desc(securityEvents.id)).limit(51).offset(offset);
		return rows.map((row) => ({ ...row, action: row.action as SecurityAction }));
	}
	/** @brief Loads a factor. @param userId Owner. @return Factor or null. */
	async findTotp(userId: string) {
		return (await this.db.select().from(administratorTotp).where(eq(administratorTotp.userId, userId)).limit(1))[0] ?? null;
	}
	/** @brief Serializes verification with account mutations. @param userId Owner. @param version Epoch. @param step Time step. @return Whether consumed. */
	async consumeTotp(userId: string, version: number, step: number) {
		return this.db.transaction(async (tx) => {
			const owner = (await tx.select().from(users).where(eq(users.id, userId)).for('update'))[0];
			if (!owner?.isActive || owner.sessionVersion !== version) { return false; }
			const rows = await tx.update(administratorTotp).set({ lastStep: step })
				.where(and(eq(administratorTotp.userId, userId), lt(administratorTotp.lastStep, step))).returning();
			return rows.length === 1;
		});
	}
	/** @brief Enables a verified factor and invalidates all sessions. @param userId Owner. @param version Epoch. @param passwordHash Password. @param secret Ciphertext. @param step Step. @return Whether enabled. */
	async enableTotp(userId: string, version: number, passwordHash: string, secret: string, step: number) {
		return this.db.transaction(async (tx) => {
			const owner = (await tx.select().from(users).where(eq(users.id, userId)).for('update'))[0];
			if (!owner?.isActive || owner.role !== 'admin' || owner.sessionVersion !== version || owner.passwordHash !== passwordHash) { return false; }
			const rows = await tx.insert(administratorTotp).values({ userId, sealedSecret: secret, lastStep: step })
				.onConflictDoNothing().returning();
			if (!rows[0]) { return false; }
			await tx.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId));
			await tx.delete(sessions).where(eq(sessions.userId, userId));
			await tx.insert(securityEvents).values({ id: randomUUID(), action: 'totp.enabled', actorId: userId, targetId: userId });
			return true;
		});
	}
	/** @brief Disables a factor only with a fresh code and current credentials. @param userId Owner. @param version Epoch. @param passwordHash Password. @param step Step. @return Whether disabled. */
	async disableTotp(userId: string, version: number, passwordHash: string, step: number) {
		return this.db.transaction(async (tx) => {
			const owner = (await tx.select().from(users).where(eq(users.id, userId)).for('update'))[0];
			if (!owner?.isActive || owner.sessionVersion !== version || owner.passwordHash !== passwordHash) { return false; }
			const rows = await tx.delete(administratorTotp)
				.where(and(eq(administratorTotp.userId, userId), lt(administratorTotp.lastStep, step))).returning();
			if (!rows[0]) { return false; }
			await tx.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId));
			await tx.delete(sessions).where(eq(sessions.userId, userId));
			await tx.insert(securityEvents).values({ id: randomUUID(), action: 'totp.disabled', actorId: userId, targetId: userId });
			return true;
		});
	}
	/** @brief Deletes selected posts with a transactional audit. @param actorId Admin. @param ids Bounded ids. @return Deleted count. */
	async deletePosts(actorId: string, ids: string[]) {
		return this.db.transaction(async (tx) => {
			const actor = (await tx.select().from(users).where(eq(users.id, actorId)).for('update'))[0];
			if (!actor?.isActive || actor.role !== 'admin') { throw new Error('Administrator unavailable'); }
			const rows = await tx.delete(posts).where(inArray(posts.id, ids)).returning({ id: posts.id });
			if (rows.length) {
				await tx.insert(securityEvents).values({ id: randomUUID(), action: 'posts.deleted',
					actorId, targetId: rows.length === 1 ? rows[0]!.id : null, count: rows.length });
			}
			return rows.length;
		});
	}
}

/** @brief Creates security persistence. @param db Database. @return Repository. */
export function createDrizzleSecurity(db: AppDb): SecurityRepository { return new DrizzleSecurity(db); }
