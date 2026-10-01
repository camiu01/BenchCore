/**
 * @file memory.ts
 * @brief In-memory repository implementations for unit tests (no database).
 */
import { randomUUID } from 'node:crypto';
import type {
	PostRepository,
	PostWithTags,
	SessionRepository,
	TagRepository,
	UserRepository
} from './repositories.js';
import type { PostRow, SessionRow, TagRow, UserRow } from './schema.js';

/**
 * @brief Sorts posts newest-first by published/created date.
 * @param rows The rows to sort.
 * @return The sorted rows.
 */
function newestFirst(rows: PostRow[]): PostRow[] {
	return [...rows].sort((a, b) => {
		const left = (a.publishedAt ?? a.createdAt).getTime();
		const right = (b.publishedAt ?? b.createdAt).getTime();
		return right - left;
	});
}

/**
 * @brief Creates an in-memory user repository.
 * @return The repository.
 */
export function createMemoryUsers(): UserRepository {
	const rows = new Map<string, UserRow>();
	return {
		async findByEmail(email: string): Promise<UserRow | null> {
			for (const row of rows.values()) {
				if (row.email === email) {
					return row;
				}
			}
			return null;
		},
		async findById(id: string): Promise<UserRow | null> {
			return rows.get(id) ?? null;
		},
		async create(input: Omit<UserRow, 'createdAt'>): Promise<UserRow> {
			const row: UserRow = { ...input, createdAt: new Date() };
			rows.set(row.id, row);
			return row;
		}
	};
}

/**
 * @brief Creates an in-memory session repository.
 * @param users The user repository used to join session owners.
 * @return The repository.
 */
export function createMemorySessions(users: UserRepository): SessionRepository {
	const rows = new Map<string, SessionRow>();
	return {
		async create(input: {
			id: string;
			tokenHash: string;
			userId: string;
			expiresAt: Date;
		}): Promise<SessionRow> {
			const row: SessionRow = { ...input, createdAt: new Date() };
			rows.set(row.tokenHash, row);
			return row;
		},
		async findByTokenHash(tokenHash: string): Promise<(SessionRow & { user: UserRow }) | null> {
			const row = rows.get(tokenHash) ?? null;
			if (row === null) {
				return null;
			}
			const user = await users.findById(row.userId);
			return user === null ? null : { ...row, user };
		},
		async deleteByTokenHash(tokenHash: string): Promise<void> {
			rows.delete(tokenHash);
		},
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

/**
 * @brief Creates an in-memory tag repository sharing link state with posts.
 * @param links The shared postId -> tagId link store.
 * @return The repository.
 */
export function createMemoryTags(links: Map<string, Set<string>>): TagRepository {
	const rows = new Map<string, TagRow>();
	const byName = new Map<string, TagRow>();
	return {
		async list(): Promise<TagRow[]> {
			return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
		},
		async upsertByName(names: string[]): Promise<TagRow[]> {
			const result: TagRow[] = [];
			for (const raw of names) {
				const name = raw.trim();
				if (name === '') {
					continue;
				}
				const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
				const existing = byName.get(name.toLowerCase());
				if (existing !== undefined) {
					result.push(existing);
					continue;
				}
				const row: TagRow = { id: randomUUID(), slug: slug === '' ? randomUUID() : slug, name };
				rows.set(row.id, row);
				byName.set(name.toLowerCase(), row);
				result.push(row);
			}
			return result;
		},
		async setPostTags(postId: string, tagIds: string[]): Promise<void> {
			links.set(postId, new Set(tagIds));
		},
		async getPostTagNames(postId: string): Promise<string[]> {
			const ids = links.get(postId) ?? new Set<string>();
			const names: string[] = [];
			for (const id of ids) {
				const row = rows.get(id);
				if (row !== undefined) {
					names.push(row.name);
				}
			}
			return names.sort();
		}
	};
}

/**
 * @brief Creates an in-memory post repository.
 * @param tags The tag repository used to attach tag names.
 * @param links The shared postId -> tagId link store.
 * @return The repository.
 */
export function createMemoryPosts(tags: TagRepository, links: Map<string, Set<string>>): PostRepository {
	const rows = new Map<string, PostRow>();

	/**
	 * @brief Attaches tag names to a post row.
	 * @param row The post row.
	 * @return The row with tag names.
	 */
	async function withTags(row: PostRow): Promise<PostWithTags> {
		return { ...row, tags: await tags.getPostTagNames(row.id) };
	}

	return {
		async create(input: Omit<PostRow, 'createdAt' | 'updatedAt'>): Promise<PostRow> {
			const now = new Date();
			const row: PostRow = { ...input, createdAt: now, updatedAt: now };
			rows.set(row.id, row);
			return row;
		},
		async update(id: string, patch: Partial<PostRow>): Promise<PostRow | null> {
			const row = rows.get(id) ?? null;
			if (row === null) {
				return null;
			}
			const next: PostRow = { ...row, ...patch, id: row.id, updatedAt: new Date() };
			rows.set(id, next);
			return next;
		},
		async remove(id: string): Promise<boolean> {
			links.delete(id);
			return rows.delete(id);
		},
		async findById(id: string): Promise<PostRow | null> {
			return rows.get(id) ?? null;
		},
		async findBySlug(slug: string): Promise<PostRow | null> {
			for (const row of rows.values()) {
				if (row.slug === slug) {
					return row;
				}
			}
			return null;
		},
		async listPublished(options: {
			limit: number;
			offset: number;
			tag?: string | undefined;
			now: Date;
		}): Promise<{ items: PostWithTags[]; total: number }> {
			const visible = newestFirst(
				[...rows.values()].filter(
					(row) =>
						row.status === 'published' && row.publishedAt !== null && row.publishedAt <= options.now
				)
			);
			const filtered: PostRow[] = [];
			for (const row of visible) {
				if (options.tag !== undefined) {
					const names = await tags.getPostTagNames(row.id);
					if (!names.includes(options.tag)) {
						continue;
					}
				}
				filtered.push(row);
			}
			const items: PostWithTags[] = [];
			for (const row of filtered.slice(options.offset, options.offset + options.limit)) {
				items.push(await withTags(row));
			}
			return { items, total: filtered.length };
		},
		async listAll(): Promise<PostWithTags[]> {
			const items: PostWithTags[] = [];
			for (const row of newestFirst([...rows.values()])) {
				items.push(await withTags(row));
			}
			return items;
		}
	};
}
