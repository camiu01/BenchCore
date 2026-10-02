/**
 * @file account-maintenance.ts
 * @brief Atomic operator password rotation and session revocation.
 */
import { eq, sql } from 'drizzle-orm';
import type { AppDb } from './client.js';
import { sessions, users } from './schema.js';

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
		return true;
	});
}
