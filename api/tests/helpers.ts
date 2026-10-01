/**
 * @file helpers.ts
 * @brief Shared test wiring: in-memory repositories plus a temp-dir media store.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMemoryPosts, createMemorySessions, createMemoryTags, createMemoryUsers } from '../src/db/memory.js';
import type { PostRepository, SessionRepository, TagRepository, UserRepository } from '../src/db/repositories.js';
import { createLocalStorage, type StorageProvider } from '../src/media/storage.js';
import type { ApiDeps } from '../src/server.js';

/**
 * @brief In-memory repository bundle for tests.
 */
export interface TestRepos {
	users: UserRepository;
	sessions: SessionRepository;
	posts: PostRepository;
	tags: TagRepository;
	media: StorageProvider;
}

/**
 * @brief Builds an isolated repository bundle per test file.
 * @return The repositories plus a temp media directory.
 */
export function createTestRepos(): TestRepos {
	const links = new Map<string, Set<string>>();
	const users = createMemoryUsers();
	const tags = createMemoryTags(links);
	return {
		users,
		sessions: createMemorySessions(users),
		posts: createMemoryPosts(tags, links),
		tags,
		media: createLocalStorage(mkdtempSync(join(tmpdir(), 'blog-media-')))
	};
}

/**
 * @brief Builds API handler dependencies from test repositories.
 * @param repos The test repositories.
 * @return The handler dependencies.
 */
export function createTestDeps(repos: TestRepos): ApiDeps {
	return { ...repos, cookieSecure: false };
}
