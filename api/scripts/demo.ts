/**
 * @file demo.ts
 * @brief Loopback-only, database-free preview using authored sample content.
 */
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	createMemoryComments,
	createMemoryLikes,
	createMemoryPosts,
	createMemorySessions,
	createMemoryTags,
	createMemoryUsers
} from '../src/db/memory.js';
import { createLocalStorage } from '../src/media/storage.js';
import { importDirectory } from '../src/posts/import-service.js';
import { createPost } from '../src/posts/post-service.js';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../src/auth/password.js';
import { usernameField } from '../src/auth/credentials.js';
import { createHandler, parsePort, startServer } from '../src/server.js';

const links = new Map<string, Set<string>>();
const users = createMemoryUsers();
const tags = createMemoryTags(links);
const likes = createMemoryLikes();
const repos = {
	users,
	tags,
	posts: createMemoryPosts(tags, links, likes),
	sessions: createMemorySessions(users),
	comments: createMemoryComments(),
	likes
};
const adminUsername = process.env['ADMIN_USERNAME'];
const adminPassword = process.env['ADMIN_PASSWORD'];
if (adminUsername && adminPassword) {
	const username = usernameField.parse(adminUsername);
	await users.create({
		id: randomUUID(), username, email: `${username}@preview.invalid`,
		name: adminUsername, role: 'admin', passwordHash: await hashPassword(adminPassword)
	});
}
const result = await importDirectory(fileURLToPath(new URL('../../content/posts', import.meta.url)), repos);
if (result.errors.length > 0) {
	process.stderr.write('demo content import failed; check content/posts\n');
	process.exit(1);
}
const samples = [
	{ title: 'A publishing platform, built like an engineering log', slug: 'demo-engineering-log',
		description: 'Markdown at the desk. PostgreSQL at runtime. A small, deliberate publishing stack.',
		tags: ['engineering', 'typescript'],
		contentMarkdown: '# A small, deliberate stack\n\nWrite in Markdown with TOML frontmatter. Publish through a standalone API. Read without trackers.\n\n## The architecture\n\n- SvelteKit renders API data.\n- PostgreSQL owns the runtime content.\n- Sanitized Markdown keeps reading safe.\n\nSee [[demo-search]].' },
	{ title: 'Search, scheduling and a quieter web', slug: 'demo-search',
		description: 'Full-text search, scheduled drafts and a no-telemetry policy for release 0.5.0.',
		tags: ['release', 'engineering'],
		contentMarkdown: '# Release 0.5.0\n\nSearch the archive. Schedule a draft. Choose a light, dark or OLED theme.\n\n> No analytics scripts. No third-party trackers.\n\nThis content is synthetic and lives only in the local preview.' }
];
for (const sample of samples) {
	await createPost(repos, { ...sample, status: 'published', publishedAt: '2026-10-01T12:00:00Z' });
}
const media = createLocalStorage(await mkdtemp(join(tmpdir(), 'blog-preview-')));
const server = startServer(parsePort(process.env['DEMO_PORT']), createHandler({
	...repos, media, cookieSecure: false,
	allowedOrigins: ['http://localhost:5173', 'http://localhost:5180']
}), '127.0.0.1');
server.on('listening', () => {
	process.stdout.write('demo API ready on loopback; synthetic samples; authored drafts stay private; optional environment-only admin\n');
});
