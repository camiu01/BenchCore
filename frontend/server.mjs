/**
 * @file server.mjs
 * @brief Production frontend bootstrap with runtime canonical origins and bounded uploads.
 */
import { createServer } from 'node:http';
import { applyRuntimeOrigin, runtimeSettings } from './runtime.mjs';

const settings = runtimeSettings(process.env);
process.env['PROTOCOL_HEADER'] = 'x-platform-protocol';
process.env['HOST_HEADER'] = 'x-platform-host';
process.env['BODY_SIZE_LIMIT'] ??= '8M';
const handlerUrl = new URL('./build/handler.js', import.meta.url);
const { handler } = await import(handlerUrl.href);
const server = createServer((req, res) => {
	applyRuntimeOrigin(req, settings.origin);
	handler(req, res);
});
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.listen(settings.port, settings.host, () => {
	process.stdout.write(`frontend listening on port ${settings.port}\n`);
});
process.once('SIGTERM', () => {
	server.close(() => process.exit(0));
});
process.once('SIGINT', () => {
	server.close(() => process.exit(0));
});
