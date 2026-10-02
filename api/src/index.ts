/**
 * @file index.ts
 * @brief API entrypoint: wires persistence, selectable media, security and scheduled publishing.
 */
import { getDb } from './db/client.js';
import { createDrizzleRepos } from './db/drizzle.js';
import { createDatabaseStorage, createLocalStorage } from './media/storage.js';
import { createDrizzleMedia } from './db/drizzle-media.js';
import { configuredOrigins } from './http/security.js';
import { startPublishingJob } from './posts/scheduler.js';
import { DEFAULT_PORT, MEDIA_PREFIX, createHandler, parsePort, startServer } from './server.js';

const mediaDir = process.env['MEDIA_DIR'] ?? './data/media';
const db = getDb();
const repos = createDrizzleRepos(db);
const backend = process.env['MEDIA_STORAGE'] ?? 'local';
if (backend !== 'local' && backend !== 'database') {
	throw new Error('MEDIA_STORAGE must be local or database');
}
const handler = createHandler({
	...repos,
	media: backend === 'database' ? createDatabaseStorage(createDrizzleMedia(db)) : createLocalStorage(mediaDir),
	cookieSecure: process.env['NODE_ENV'] === 'production',
	allowedOrigins: configuredOrigins(process.env)
});

const port = parsePort(process.env['PORT'], DEFAULT_PORT);
const server = startServer(port, handler, process.env['HOST']);
const stopPublishing = startPublishingJob(repos.posts);
server.once('close', stopPublishing);

server.on('listening', () => {
	process.stdout.write(`benchcore-api listening on port ${port} (media: ${MEDIA_PREFIX})\n`);
});
