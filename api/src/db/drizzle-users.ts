/**
 * @file drizzle-users.ts
 * @brief User persistence with serialized admin changes and version-based session revocation.
 */
import { and, count, eq, sql } from 'drizzle-orm';
import type { AppDb } from './client.js';
import type { UserCreate, UserPatch, UserRepository } from './repositories.js';
import { sessions, users } from './schema.js';

/** @brief SQL-backed account operations. */
class DrizzleUsers implements UserRepository {
	/** @brief Retains persistence. @param db Database. */
	constructor(private readonly db: AppDb) {}
	/** @brief Finds a username. @param username Login. @return Owner or null. */
	async findByUsername(username: string) {
		return (await this.db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1))[0] ?? null;
	}
	/** @brief Finds an email. @param email Email. @return Owner or null. */
	async findByEmail(email: string) {
		return (await this.db.select().from(users).where(sql`lower(${users.email}) = ${email.toLowerCase()}`).limit(1))[0] ?? null;
	}
	/** @brief Finds an id. @param id Owner. @return Row or null. */
	async findById(id: string) {
		return (await this.db.select().from(users).where(eq(users.id, id)).limit(1))[0] ?? null;
	}
	/** @brief Creates an account. @param input Fields. @return Row. */
	async create(input: UserCreate) {
		const row = (await this.db.insert(users).values({ ...input, username: input.username?.toLowerCase() ?? null }).returning())[0];
		if (!row) { throw new Error('user insert returned no row'); }
		return row;
	}
	/** @brief Lists accounts. @param limit Page size. @param offset Offset. @return Page. */
	async listPage(limit: number, offset: number) {
		const items = await this.db.select().from(users).orderBy(users.createdAt, users.id).limit(limit).offset(offset);
		const totals = await this.db.select({ total: count() }).from(users);
		return { items, total: totals[0]?.total ?? 0 };
	}
	/** @brief Changes one hash atomically. @param id Owner. @param currentHash Expected hash. @param newHash Replacement. @return Whether changed. */
	async changePassword(id: string, currentHash: string, newHash: string) {
		return this.db.transaction(async (tx) => {
			const rows = await tx.update(users).set({ passwordHash: newHash, sessionVersion: sql`${users.sessionVersion} + 1` })
				.where(and(eq(users.id, id), eq(users.passwordHash, currentHash), eq(users.isActive, true))).returning({ id: users.id });
			if (!rows[0]) { return false; }
			await tx.delete(sessions).where(eq(sessions.userId, id));
			return true;
		});
	}
	/** @brief Serializes admin mutations to preserve an active administrator. @param actorId Admin. @param id Target. @param patch Fields. @return Result. */
	async manage(actorId: string, id: string, patch: UserPatch) {
		return this.db.transaction(async (tx) => {
			await tx.execute(sql`select pg_advisory_xact_lock(1638152401)`);
			const actor = (await tx.select().from(users).where(eq(users.id, actorId)).limit(1))[0];
			if (!actor?.isActive || actor.role !== 'admin') { return 'forbidden' as const; }
			const row = (await tx.select().from(users).where(eq(users.id, id)).limit(1))[0];
			if (!row) { return null; }
			const next = { ...row, ...patch };
			if (row.isActive && row.role === 'admin' && (!next.isActive || next.role !== 'admin')) {
				const totals = await tx.select({ total: count() }).from(users).where(and(eq(users.role, 'admin'), eq(users.isActive, true)));
				if ((totals[0]?.total ?? 0) <= 1) { return 'last_admin' as const; }
			}
			const result = (await tx.update(users).set({ ...patch, sessionVersion: sql`${users.sessionVersion} + 1` })
				.where(eq(users.id, id)).returning())[0] ?? null;
			await tx.delete(sessions).where(eq(sessions.userId, id));
			return result;
		});
	}
}

/** @brief Creates user persistence. @param db Database. @return Repository. */
export function createDrizzleUsers(db: AppDb): UserRepository { return new DrizzleUsers(db); }
