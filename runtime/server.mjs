/**
 * @file server.mjs
 * @brief Single public-port beta bootstrap with private SSR API, probes and bounded shutdown.
 */
import { createServer } from 'node:http';
import { once } from 'node:events';
import { platformSettings } from './settings.mjs';
import { createBridge } from './bridge.mjs';
import { cachedProbe, createPlatformHandler } from './router.mjs';

/**
 * @brief Starts production without migrating, provisioning or publishing content.
 * @return {Promise<void>} Completion of bootstrap.
 */
async function main() {
	const settings = platformSettings(process.env);
	const dbModule = await import(new URL('../api/dist/db/client.js', import.meta.url).href);
	const { createDrizzleRepos } = await import(new URL('../api/dist/db/drizzle.js', import.meta.url).href);
	const { createHandler } = await import(new URL('../api/dist/server.js', import.meta.url).href);
	const { configuredStorage } = await import(new URL('../api/dist/media/configured.js', import.meta.url).href);
	const { startPublishingJob } = await import(new URL('../api/dist/posts/scheduler.js', import.meta.url).href);
	await dbModule.checkDb();
	const db = dbModule.getDb();
	const repos = createDrizzleRepos(db);
	const bridge = createBridge();
	const media = configuredStorage(db, process.env);
	const common = { ...repos, media, cookieSecure: settings.origin.protocol === 'https:', allowedOrigins: [settings.origin.origin] };
	const internal = createServer(createHandler({ ...common, clientAddress: bridge.address }));
	internal.requestTimeout = 30_000;
	internal.headersTimeout = 15_000;
	internal.listen(0, '127.0.0.1');
	await once(internal, 'listening');
	const address = internal.address();
	if (!address || typeof address === 'string') { throw new Error('Private API did not start'); }
	const base = `http://127.0.0.1:${address.port}`;
	process.env['PUBLIC_API_URL'] = base;
	process.env['SITE_URL'] = settings.origin.origin;
	process.env['PUBLIC_SITE_URL'] = settings.origin.origin;
	process.env['PROTOCOL_HEADER'] = 'x-platform-protocol';
	process.env['HOST_HEADER'] = 'x-platform-host';
	process.env['BODY_SIZE_LIMIT'] ??= '8M';
	const registry = /** @type {Record<symbol, (input: string, init?: RequestInit) => Promise<Response>>} */
		(/** @type {unknown} */ (globalThis));
	registry[Symbol.for('publishing.api.fetch')] = (input, init) => bridge.fetch(base, input, init);
	const { handler } = await import(new URL('../frontend/build/handler.js', import.meta.url).href);
	const api = createHandler({ ...common, clientAddress: () => bridge.context.getStore() ?? 'unknown' });
	const server = createServer(createPlatformHandler({ api, frontend: handler, ready: cachedProbe(dbModule.checkDb), settings, context: bridge.context }));
	server.requestTimeout = 30_000;
	server.headersTimeout = 15_000;
	server.listen(settings.port, settings.host);
	await once(server, 'listening');
	installShutdown(server, internal, process.env['SCHEDULER_ENABLED'] === 'false' ? () => {}
		: startPublishingJob(repos.posts), dbModule.closeDb);
	process.stdout.write(`BenchCore beta listening on port ${settings.port}\n`);
}

/**
 * @brief Drains both listeners and the pool, with a hard shutdown deadline.
 * @param {import('node:http').Server} server Public listener.
 * @param {import('node:http').Server} internal Private listener.
 * @param {() => void} stopJob Publication timer cleanup.
 * @param {() => Promise<void>} closeDb Database cleanup.
 * @return {void} Nothing.
 */
function installShutdown(server, internal, stopJob, closeDb) {
	let stopping = false;
	/**
	 * @brief Stops accepting traffic and closes resources without logging credentials.
	 * @return {Promise<void>} Shutdown completion.
	 */
	async function stop() {
		if (stopping) { return; }
		stopping = true;
		stopJob();
		const deadline = setTimeout(() => process.exit(1), 15_000);
		deadline.unref();
		try {
			await new Promise((resolve) => server.close(resolve));
			await new Promise((resolve) => internal.close(resolve));
			await closeDb();
			clearTimeout(deadline);
			process.exit(0);
		} catch { process.exit(1); }
	}
	process.once('SIGTERM', stop);
	process.once('SIGINT', stop);
}

main().catch(() => {
	process.stderr.write('Beta startup failed; check configuration, PostgreSQL and the built application\n');
	process.exit(1);
});
