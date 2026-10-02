/**
 * @file memory-users.ts
 * @brief In-memory accounts with case-folded identities and versioned session revocation.
 */
import type { UserCreate, UserPatch, UserRepository } from './repositories.js';
import type { UserRow } from './schema.js';

/** @brief Synchronous account mutations emulate atomic database operations. */
class MemoryUsers implements UserRepository {
	private readonly rows = new Map<string, UserRow>();
	/** @brief Finds a username. @param username Login. @return Owner or null. */
	async findByUsername(username: string) {
		return [...this.rows.values()].find((row) => row.username === username.toLowerCase()) ?? null;
	}
	/** @brief Finds an email. @param email Email. @return Owner or null. */
	async findByEmail(email: string) {
		return [...this.rows.values()].find((row) => row.email.toLowerCase() === email.toLowerCase()) ?? null;
	}
	/** @brief Finds an owner. @param id Owner. @return Row or null. */
	async findById(id: string) { return this.rows.get(id) ?? null; }
	/** @brief Creates a unique owner. @param input Fields. @return Created owner. */
	async create(input: UserCreate): Promise<UserRow> {
		const username = input.username?.toLowerCase() ?? null;
		if ([...this.rows.values()].some((row) => row.email.toLowerCase() === input.email.toLowerCase()
			|| username !== null && row.username === username)) { throw new Error('user already exists'); }
		const row: UserRow = { ...input, username, isActive: input.isActive ?? true,
			sessionVersion: input.sessionVersion ?? 0, createdAt: new Date() };
		this.rows.set(row.id, row);
		return row;
	}
	/** @brief Lists owners. @param limit Size. @param offset Offset. @return Page. */
	async listPage(limit: number, offset: number) {
		const all = [...this.rows.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
		return { items: all.slice(offset, offset + limit), total: all.length };
	}
	/** @brief Performs hash compare-and-swap. @param id Owner. @param currentHash Expected hash. @param newHash Replacement. @return Whether changed. */
	async changePassword(id: string, currentHash: string, newHash: string) {
		const row = this.rows.get(id);
		if (!row || !row.isActive || row.passwordHash !== currentHash) { return false; }
		this.rows.set(id, { ...row, passwordHash: newHash, sessionVersion: row.sessionVersion + 1 });
		return true;
	}
	/** @brief Applies protected admin changes. @param actorId Admin. @param id Target. @param patch Fields. @return Result. */
	async manage(actorId: string, id: string, patch: UserPatch) {
		const actor = this.rows.get(actorId);
		if (!actor?.isActive || actor.role !== 'admin') { return 'forbidden' as const; }
		const row = this.rows.get(id);
		if (!row) { return null; }
		const next = { ...row, ...patch, sessionVersion: row.sessionVersion + 1 };
		if (row.isActive && row.role === 'admin' && (!next.isActive || next.role !== 'admin')
			&& [...this.rows.values()].filter((user) => user.isActive && user.role === 'admin').length === 1) {
			return 'last_admin' as const;
		}
		this.rows.set(id, next);
		return next;
	}
}

/** @brief Creates account persistence. @return Repository. */
export function createMemoryUsers(): UserRepository { return new MemoryUsers(); }
