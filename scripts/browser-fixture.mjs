/**
 * @file browser-fixture.mjs
 * @brief Disposable loopback-only production UI fixture with memory persistence and no external services.
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMemoryTags, createMemoryPosts, createMemoryLikes, createMemoryUsers,
	createMemorySessions, createMemoryComments } from '../api/dist/db/memory.js';
import { createMemorySecurity } from '../api/dist/db/memory-security.js';
import { createMemoryNewsletter } from '../api/dist/db/memory-newsletter.js';
import { createPost } from '../api/dist/posts/post-service.js';
import { createLocalStorage } from '../api/dist/media/storage.js';
import { createHandler } from '../api/dist/server.js';
import { hashPassword } from '../api/dist/auth/password.js';
import { createVercelHandler } from '../api/dist/serverless/handler.js';
import { nodeHandlerFetch } from '../api/dist/http/web.js';
import { fixtureFetch } from './fixture-fetch.mjs';

const port = 5198;
const origin = `http://127.0.0.1:${port}`;
const links = new Map();
/** @type {import('../api/dist/db/security-repository.js').SecurityEvent[]} */
const events = [];
const tags = createMemoryTags(links), likes = createMemoryLikes(), users = createMemoryUsers(events);
const posts = createMemoryPosts(tags, links, likes);
const directory = await mkdtemp(join(tmpdir(), 'benchcore-browser-'));
const deps = {
	tags, likes, users, posts, sessions: createMemorySessions(users), comments: createMemoryComments(),
	security: createMemorySecurity(users, posts, events), media: createLocalStorage(directory),
	newsletter: { repository: createMemoryNewsletter() },
	totpKey: 'a'.repeat(64), cookieSecure: false, allowedOrigins: [origin],
	rateLimit: { requests: 100_000, loginRequests: 1000, windowMs: 60_000 }
};
const adminId = randomUUID();
await users.create({ id: adminId, username: 'fixture-admin', email: 'admin@fixture.invalid',
	name: 'Fixture administrator', role: 'admin', passwordHash: await hashPassword('fixture-browser-password') });
await deps.security.record({ action: 'user.created', actorId: adminId, targetId: adminId });
await createPost(deps, { title: 'Accessible engineering', slug: 'accessible-engineering', status: 'published',
	category: 'Research', tags: ['Engineering & circuits'], description: 'Circuits < signals & safe XML.',
	contentMarkdown: '## First section\n\nReadable public content.\n\n## Second section\n\nSee [[accessible-engineering]].' });
await createPost(deps, { title: 'Private engineering', slug: 'private-engineering', status: 'published',
	audience: 'readers', tags: ['Engineering & circuits'], description: 'Protected fixture description.',
	contentMarkdown: 'Protected fixture body.' });
const draft = await createPost(deps, { title: 'Draft engineering', slug: 'draft-engineering', status: 'draft',
	tags: ['Engineering & circuits'], contentMarkdown: 'Unpublished fixture body.' });
await deps.comments.create({ id: randomUUID(), postId: draft.id, authorName: 'Fixture reader', content: 'Fixture pending comment.' });
const handler = createHandler(deps);
const serverless = createVercelHandler({}, () => ({
	handler, ready: async () => {}, fetch: (req, peer) => nodeHandlerFetch(handler, req, peer)
}));
const api = createServer(process.env['E2E_TARGET'] === 'serverless'
	? (req, res) => { void fixtureFetch(req, res, serverless); } : handler);
await new Promise((resolve) => api.listen(0, '127.0.0.1', () => resolve(undefined)));
const address = api.address();
if (!address || typeof address === 'string') { throw new Error('Missing fixture listener'); }
Object.assign(process.env, { PUBLIC_API_URL: `http://127.0.0.1:${address.port}`,
	SITE_URL: origin, PUBLIC_SITE_URL: origin, API_GUEST_CACHE_MS: '0', SCHEDULER_ENABLED: 'false',
	PROTOCOL_HEADER: 'x-platform-protocol', HOST_HEADER: 'x-platform-host' });
delete process.env['DATABASE_URL'];
delete process.env['API_SERVICE_URL'];
delete process.env['DEPLOYMENT_TARGET'];
delete process.env['VERCEL'];
const frontendEntry = new URL('../frontend/build/handler.js', import.meta.url).href;
const { handler: frontend } = await import(frontendEntry);
const web = createServer((req, res) => {
	req.headers['x-platform-protocol'] = 'http';
	req.headers['x-platform-host'] = `127.0.0.1:${port}`;
	if (req.url === '/health/live') { res.end('ok'); return; }
	if (req.url === '/api' || req.url?.startsWith('/api/')) { void api.emit('request', req, res); return; }
	frontend(req, res);
});
await new Promise((resolve) => web.listen(port, '127.0.0.1', () => resolve(undefined)));
process.stdout.write(`Browser fixture ready (${process.env['E2E_TARGET'] ?? 'node'}), loopback and memory only.\n`);

/** @brief Stops only fixture listeners and removes its own temporary files. @return Completion. */
async function stop() {
	await Promise.all([new Promise((resolve) => web.close(resolve)), new Promise((resolve) => api.close(resolve))]);
	await rm(directory, { recursive: true, force: true });
}
process.once('SIGTERM', () => { void stop(); });
process.once('SIGINT', () => { void stop(); });
