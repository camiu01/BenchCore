/**
 * @file index.ts
 * @brief API entrypoint: wires persistence, selectable media, security and scheduled publishing.
 */
import { getDb } from './db/client.js';
import { createDrizzleRepos } from './db/drizzle.js';
import { configuredStorage } from './media/configured.js';
import { configuredOrigins } from './http/security.js';
import { startPublishingJob } from './posts/scheduler.js';
import { DEFAULT_PORT, MEDIA_PREFIX, createHandler, parsePort, startServer } from './server.js';

const db = getDb();
const repos = createDrizzleRepos(db);
const backend = process.env['MEDIA_STORAGE'] ?? 'local';
const handler = createHandler({
	...repos,
	media: configuredStorage(db, process.env),
	cookieSecure: process.env['NODE_ENV'] === 'production',
	allowedOrigins: configuredOrigins(process.env)
});

const port = parsePort(process.env['PORT'], DEFAULT_PORT);
const server = startServer(port, handler, process.env['HOST']);
const stopPublishing = process.env['SCHEDULER_ENABLED'] === 'false' ? () => {} : startPublishingJob(repos.posts);
server.once('close', stopPublishing);

server.on('listening', () => {
	process.stdout.write(`benchcore-api listening on port ${port} (media: ${MEDIA_PREFIX})\n`);
});
