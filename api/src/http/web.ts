/**
 * @file web.ts
 * @brief Adapts Web requests to existing secured Node handlers without opening listeners.
 */
import { Readable, Writable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** @brief Bounded in-memory response capture for JSON and small non-R2 reads. */
class WebResponse extends Writable {
	statusCode = 200;
	headersSent = false;
	headers = new Headers();
	chunks: Buffer[] = [];
	size = 0;
	/**
	 * @brief Sets one Node-style response header, retaining repeated cookie fields.
	 * @param name Header name. @param value Header values.
	 * @return This response capture.
	 */
	setHeader(name: string, value: string | number | string[]) {
		this.headers.delete(name);
		for (const item of Array.isArray(value) ? value : [value]) { this.headers.append(name, String(item)); }
		return this;
	}
	/**
	 * @brief Applies status and headers without changing existing security headers.
	 * @param status HTTP status. @param headers Additional response headers.
	 * @return This response capture.
	 */
	writeHead(status: number, headers: Record<string, string | number | string[]> = {}) {
		this.statusCode = status;
		for (const [name, value] of Object.entries(headers)) { this.setHeader(name, value); }
		this.headersSent = true;
		return this;
	}
	/**
	 * @brief Captures bounded chunks instead of allocating without limit.
	 * @param chunk Response bytes. @param _encoding Node write encoding.
	 * @param done Writable completion callback.
	 * @return Nothing.
	 */
	override _write(chunk: Buffer | string, _encoding: BufferEncoding, done: (error?: Error | null) => void) {
		const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		this.size += data.length;
		if (this.size > 8 * 1024 * 1024) { done(new Error('Response too large')); return; }
		this.chunks.push(data); this.headersSent = true; done();
	}
}

/**
 * @brief Calls an existing API handler in-process with a platform-provided peer identity.
 * @param handler Secured Node handler.
 * @param request Web request.
 * @param address Trusted peer from the hosting adapter, never forwarded client headers.
 * @return Standard Web response.
 */
export function nodeHandlerFetch(handler: (req: IncomingMessage, res: ServerResponse) => void,
	request: Request, address: string): Promise<Response> {
	return new Promise((resolve, reject) => {
		const body = request.body ? Readable.fromWeb(request.body as import('node:stream/web').ReadableStream) : Readable.from([]);
		const url = new URL(request.url);
		const req = Object.assign(body, { method: request.method, url: url.pathname + url.search,
			headers: Object.fromEntries(request.headers), socket: { remoteAddress: address } });
		const res = new WebResponse();
		const deadline = setTimeout(() => { body.destroy(); res.destroy(new Error('API timed out')); }, 15_000);
		deadline.unref();
		/**
		 * @brief Settles the fetch and removes caller cancellation and deadline listeners.
		 * @param failed Whether transport failed. @return Nothing.
		 */
		const finish = (failed: boolean) => {
			clearTimeout(deadline);
			request.signal.removeEventListener('abort', abort);
			body.destroy();
			if (request.signal.aborted) { reject(request.signal.reason); return; }
			if (failed) { resolve(new Response('API unavailable', { status: 503, headers: { 'cache-control': 'no-store' } })); return; }
			const bytes = Buffer.concat(res.chunks);
			resolve(new Response([204, 304].includes(res.statusCode) ? null : bytes, { status: res.statusCode, headers: res.headers }));
		};
		/** @brief Stops capture when the caller's fetch deadline expires. @return Destroyed stream. */
		const abort = () => res.destroy(new Error('Request aborted'));
		res.once('finish', () => finish(false));
		res.once('error', () => finish(true));
		request.signal.addEventListener('abort', abort, { once: true });
		if (request.signal.aborted) { abort(); return; }
		try { handler(req as unknown as IncomingMessage, res as unknown as ServerResponse); }
		catch { res.destroy(new Error('API unavailable')); }
	});
}
