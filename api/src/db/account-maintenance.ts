/**
 * @file account-maintenance.ts
 * @brief Atomic operator password rotation and session revocation.
 */
import { eq, sql } from 'drizzle-orm';
import type { AppDb } from './client.js';
import { administratorTotp, passwordResetTokens, securityEvents, sessions, users } from './schema.js';
import { randomUUID } from 'node:crypto';

/**
 * @brief Replaces a named account's hash and revokes every session in the same transaction.
 * @param db Database handle.
 * @param username Canonical username.
 * @param passwordHash New scrypt hash.
 * @return Whether an existing account was changed.
 */
export async function rotatePassword(db: AppDb, username: string, passwordHash: string): Promise<boolean> {
	return db.transaction(async (tx) => {
		const rows = await tx.update(users).set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1` })
			.where(eq(users.username, username)).returning({ id: users.id });
		const row = rows[0];
		if (!row) { return false; }
		await tx.delete(sessions).where(eq(sessions.userId, row.id));
		await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, row.id));
		await tx.insert(securityEvents).values({ id: randomUUID(), action: 'password.changed', actorId: null, targetId: row.id });
		return true;
	});
}

/** @brief Removes a lost factor only through explicit offline operator recovery. @param db Database. @param username Canonical owner. @return Whether removed. */
export async function recoverTotp(db: AppDb, username: string): Promise<boolean> {
	return db.transaction(async (tx) => {
		const user = (await tx.select().from(users).where(eq(users.username, username)).for('update'))[0];
		if (!user) { return false; }
		const removed = await tx.delete(administratorTotp).where(eq(administratorTotp.userId, user.id)).returning();
		if (!removed[0]) { return false; }
		await tx.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, user.id));
		await tx.delete(sessions).where(eq(sessions.userId, user.id));
		await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
		await tx.insert(securityEvents).values({ id: randomUUID(), action: 'totp.disabled', actorId: null, targetId: user.id });
		return true;
	});
}
