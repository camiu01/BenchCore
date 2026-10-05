/**
 * @file memory.ts
 * @brief In-memory repository implementations for unit tests (no database).
 */
import { randomUUID } from 'node:crypto';
import type {
	SessionRepository,
	TagRepository,
	UserRepository
} from './repositories.js';
import type { SessionRow, TagRow, UserRow } from './schema.js';
export { createMemoryPosts } from './memory-posts.js';
export { createMemoryUsers } from './memory-users.js';
export { createMemoryComments, createMemoryLikes } from './memory-engagement.js';

/**
 * @brief Creates an in-memory session repository.
 * @param users Accounts used to join session owners.
 * @return The repository.
 */
export function createMemorySessions(users: UserRepository): SessionRepository {
	const rows = new Map<string, SessionRow>();
	return {
		/** @brief Creates a session. @param input Session fields. @return The created row. */
		async create(input: {
			id: string;
			tokenHash: string;
			userId: string;
			expiresAt: Date;
			userVersion?: number;
		}): Promise<SessionRow> {
			const row: SessionRow = { ...input, userVersion: input.userVersion ?? 0, createdAt: new Date() };
			rows.set(row.tokenHash, row);
			return row;
		},
		/** @brief Resolves session ownership. @param tokenHash The hash. @return The joined row or null. */
		async findByTokenHash(tokenHash: string): Promise<(SessionRow & { user: UserRow }) | null> {
			const row = rows.get(tokenHash) ?? null;
			if (row === null) {
				return null;
			}
			const user = await users.findById(row.userId);
			return user === null ? null : { ...row, user };
		},
		/** @brief Deletes a session. @param tokenHash The hash. @return Completion. */
		async deleteByTokenHash(tokenHash: string): Promise<void> {
			rows.delete(tokenHash);
		},
		/** @brief Deletes expired sessions. @param now The reference time. @return The deletion count. */
		async deleteExpired(now: Date): Promise<number> {
			let deleted = 0;
			for (const [key, row] of rows) {
				if (row.expiresAt <= now) {
					rows.delete(key);
					deleted += 1;
				}
			}
			return deleted;
		}
	};
}

/** @brief In-memory tags using the same name/slug resolution as PostgreSQL. */
class MemoryTags implements TagRepository {
	private readonly rows = new Map<string, TagRow>();
	private readonly byName = new Map<string, TagRow>();
	private readonly bySlug = new Map<string, TagRow>();

	/** @brief Retains shared links. @param links The post-tag link store. */
	constructor(private readonly links: Map<string, Set<string>>) {}

	/** @brief Lists tags. @return Rows ordered by name. */
	async list(): Promise<TagRow[]> {
		return [...this.rows.values()].sort((a, b) => a.name.localeCompare(b.name));
	}

	/** @brief Changes a tag color. @param id Tag id. @param color HEX color. @return Updated row or null. */
	async updateColor(id: string, color: string): Promise<TagRow | null> {
		const row = this.rows.get(id);
		if (!row) { return null; }
		const updated = { ...row, color };
		this.rows.set(id, updated);
		this.byName.set(updated.name, updated);
		this.bySlug.set(updated.slug, updated);
		return updated;
	}

	/** @brief Deletes a tag and removes it from every link set. @param id Tag id. @return Whether deleted. */
	async remove(id: string): Promise<boolean> {
		const row = this.rows.get(id);
		if (!row) { return false; }
		this.rows.delete(id);
		this.byName.delete(row.name);
		this.bySlug.delete(row.slug);
		for (const ids of this.links.values()) { ids.delete(id); }
		return true;
	}

	/**
	 * @brief Resolves names and slug aliases without duplicate result ids.
	 * @param names The submitted names.
	 * @return Canonical tag rows.
	 */
	async upsertByName(names: string[]): Promise<TagRow[]> {
		const result: TagRow[] = [];
		for (const raw of names) {
			const name = raw.trim();
			if (name === '') { continue; }
			const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
			const existing = this.byName.get(name) ?? this.bySlug.get(slug);
			if (existing !== undefined) {
				if (!result.some((row) => row.id === existing.id)) { result.push(existing); }
				continue;
			}
			const row = { id: randomUUID(), slug: slug || randomUUID(), name, color: '#64748B' };
			this.rows.set(row.id, row);
			this.byName.set(name, row);
			this.bySlug.set(row.slug, row);
			result.push(row);
		}
		return result;
	}

	/**
	 * @brief Replaces a post's tag links.
	 * @param postId The post id.
	 * @param tagIds The desired tag ids.
	 * @return Completion.
	 */
	async setPostTags(postId: string, tagIds: string[]): Promise<void> {
		this.links.set(postId, new Set(tagIds));
	}

	/**
	 * @brief Loads the names linked to a post.
	 * @param postId The post id.
	 * @return Sorted tag names.
	 */
	async getPostTagNames(postId: string): Promise<string[]> {
		const names: string[] = [];
		for (const id of this.links.get(postId) ?? []) {
			const row = this.rows.get(id);
			if (row !== undefined) { names.push(row.name); }
		}
		return names.sort();
	}
}

/**
 * @brief Creates an in-memory tag repository sharing link state with posts.
 * @param links The shared postId -> tagId link store.
 * @return The repository.
 */
export function createMemoryTags(links: Map<string, Set<string>>): TagRepository {
	return new MemoryTags(links);
}
