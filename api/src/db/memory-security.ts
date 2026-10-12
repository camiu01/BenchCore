/**
 * @file memory-security.ts
 * @brief Credential-free security history and second-factor persistence for DB-free tests.
 */
import { randomUUID } from 'node:crypto';
import type { PostRepository, UserRepository } from './repositories.js';
import type { SecurityEvent, SecurityEventInput, SecurityRepository, TotpCredential } from './security-repository.js';

/** @brief Isolated memory security persistence. */
class MemorySecurity implements SecurityRepository {
	private readonly factors = new Map<string, TotpCredential>();
	/** @brief Retains account and post contracts. @param users Accounts. @param posts Posts. @param events Shared history. @return Instance. */
	constructor(private readonly users: UserRepository, private readonly posts: PostRepository,
		private readonly events: SecurityEvent[]) {}
	/** @brief Appends a safe event. @param event Fields. @return Completion. */
	async record(event: SecurityEventInput) {
		this.events.unshift({ id: randomUUID(), count: 1, ...event, createdAt: new Date() });
	}
	/** @brief Reads a bounded page. @param offset Offset. @return Events. */
	async listEvents(offset: number) { return this.events.slice(offset, offset + 51); }
	/** @brief Reads encrypted credentials. @param userId Owner. @return Factor or null. */
	async findTotp(userId: string) { return this.factors.get(userId) ?? null; }
	/** @brief Advances the replay watermark once. @param userId Owner. @param version Epoch. @param step Step. @return Whether consumed. */
	async consumeTotp(userId: string, version: number, step: number) {
		const owner = await this.users.findById(userId);
		const factor = this.factors.get(userId);
		if (!owner?.isActive || owner.sessionVersion !== version || !factor || factor.lastStep >= step) { return false; }
		this.factors.set(userId, { ...factor, lastStep: step });
		return true;
	}
	/** @brief Enables one factor. @param userId Owner. @param version Epoch. @param passwordHash Hash. @param secret Ciphertext. @param step Step. @return Whether enabled. */
	async enableTotp(userId: string, version: number, passwordHash: string, secret: string, step: number) {
		const owner = await this.users.findById(userId);
		if (!owner?.isActive || owner.role !== 'admin' || owner.passwordHash !== passwordHash
			|| owner.sessionVersion !== version || this.factors.has(userId)) { return false; }
		this.factors.set(userId, { userId, sealedSecret: secret, lastStep: step });
		if (!await this.users.revokeSessions(userId, version)) { this.factors.delete(userId); return false; }
		await this.record({ action: 'totp.enabled', actorId: userId, targetId: userId });
		return true;
	}
	/** @brief Removes a verified factor. @param userId Owner. @param version Epoch. @param passwordHash Hash. @param step Step. @return Whether disabled. */
	async disableTotp(userId: string, version: number, passwordHash: string, step: number) {
		const owner = await this.users.findById(userId);
		const factor = this.factors.get(userId);
		if (!owner?.isActive || owner.passwordHash !== passwordHash || owner.sessionVersion !== version
			|| !factor || factor.lastStep >= step) { return false; }
		this.factors.delete(userId);
		if (!await this.users.revokeSessions(userId, version)) { this.factors.set(userId, factor); return false; }
		await this.record({ action: 'totp.disabled', actorId: userId, targetId: userId });
		return true;
	}
	/** @brief Deletes a bounded selected set. @param actorId Admin. @param ids Selected ids. @return Deleted count. */
	async deletePosts(actorId: string, ids: string[]) {
		const actor = await this.users.findById(actorId);
		if (!actor?.isActive || actor.role !== 'admin') { throw new Error('Administrator unavailable'); }
		const removed: string[] = [];
		for (const id of new Set(ids)) { if (await this.posts.remove(id)) { removed.push(id); } }
		if (removed.length) {
			await this.record({ action: 'posts.deleted', actorId, targetId: removed.length === 1 ? removed[0]! : null, count: removed.length });
		}
		return removed.length;
	}
}

/** @brief Creates memory security persistence. @param users Accounts. @param posts Posts. @param events Shared history. @return Repository. */
export function createMemorySecurity(users: UserRepository, posts: PostRepository, events: SecurityEvent[] = []): SecurityRepository {
	return new MemorySecurity(users, posts, events);
}
