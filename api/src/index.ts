/**
 * @file index.ts
 * @brief API entrypoint: wires Drizzle repositories plus local media storage.
 */
import { getDb } from './db/client.js';
import { createDrizzleRepos } from './db/drizzle.js';
import { createLocalStorage } from './media/storage.js';
import { DEFAULT_PORT, MEDIA_PREFIX, createHandler, parsePort, startServer } from './server.js';

const mediaDir = process.env['MEDIA_DIR'] ?? './data/media';
const repos = createDrizzleRepos(getDb());
const handler = createHandler({
	...repos,
	media: createLocalStorage(mediaDir),
	cookieSecure: process.env['NODE_ENV'] === 'production'
});

const port = parsePort(process.env['PORT'], DEFAULT_PORT);
const server = startServer(port, handler);

server.on('listening', () => {
	process.stdout.write(`blog-api listening on port ${port} (media: ${MEDIA_PREFIX})\n`);
});
