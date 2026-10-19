/**
 * @file fixture-fetch.mjs
 * @brief Loopback test bridge for exercising the real Node-to-Fetch API adapter over HTTP.
 */
import { nodeHandlerFetch } from '../api/dist/http/web.js';

/**
 * @brief Reads only bounded synthetic form/JSON payloads for the test bridge.
 * @param {import('node:http').IncomingMessage} req Fixture request.
 * @return {Promise<Uint8Array<ArrayBuffer>>} Request bytes.
 */
async function fixtureBody(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += bytes.length;
		if (size > 8 * 1024 * 1024) { throw new Error('Fixture body too large'); }
		chunks.push(bytes);
	}
	return new Uint8Array(Buffer.concat(chunks));
}

/**
 * @brief Forwards a fixture request through the same Fetch adapter as the Vercel entrypoint.
 * @param {import('node:http').IncomingMessage} req Fixture HTTP request.
 * @param {import('node:http').ServerResponse} res Fixture HTTP response.
 * @param {Parameters<typeof nodeHandlerFetch>[0]} handler Serverless handler.
 * @return {Promise<void>} Completed HTTP response.
 */
export async function fixtureFetch(req, res, handler) {
	const headers = new Headers();
	for (const [name, value] of Object.entries(req.headers)) {
		for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
			headers.append(name, item);
		}
	}
	const method = req.method ?? 'GET';
	try {
		const init = { method, headers, ...(['GET', 'HEAD'].includes(method) ? {} : {
			body: await fixtureBody(req)
		}) };
		const request = new Request(new URL(req.url ?? '/', 'http://fixture.test'), init);
		const response = await nodeHandlerFetch(handler, request, req.socket.remoteAddress ?? 'unknown');
		res.statusCode = response.status;
		for (const [name, value] of response.headers) {
			if (name !== 'set-cookie') { res.setHeader(name, value); }
		}
		const cookies = response.headers.getSetCookie();
		if (cookies.length) { res.setHeader('set-cookie', cookies); }
		res.end(Buffer.from(await response.arrayBuffer()));
	} catch {
		res.writeHead(503, { 'cache-control': 'no-store' });
		res.end('Fixture transport unavailable');
	}
}
