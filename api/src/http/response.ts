/**
 * @file response.ts
 * @brief Bounded JSON decoding and response helpers.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ErrorPayload } from './types.js';

export const BODY_LIMIT = 256 * 1024;
export const MEDIA_BODY_LIMIT = 8 * 1024 * 1024;
export const MEDIA_PREFIX = '/api/media';

/**
 * @brief Sends a JSON response.
 * @param res Response stream.
 * @param statusCode HTTP status.
 * @param payload Serializable value.
 * @param headers Additional response headers.
 * @return Nothing.
 */
export function sendJson(res: ServerResponse, statusCode: number, payload: unknown,
	headers: Record<string, string> = {}): void {
	res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', ...headers });
	res.end(JSON.stringify(payload));
}

/**
 * @brief Decodes JSON without destroying the socket before a 413 can be sent.
 * @param req Incoming request.
 * @param maxBytes Accepted byte limit.
 * @return Parsed data or a failure reason.
 */
export function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<
	{ ok: true; data: unknown } | { ok: false; reason: 'empty' | 'invalid' | 'too_large' }
> {
	return new Promise((resolve) => {
		const chunks: Buffer[] = [];
		let size = 0;
		let settled = false;
		req.on('data', (chunk: Buffer) => {
			if (settled) { return; }
			size += chunk.length;
			if (size > maxBytes) {
				settled = true;
				chunks.length = 0;
				resolve({ ok: false, reason: 'too_large' });
				return;
			}
			chunks.push(chunk);
		});
		req.on('end', () => {
			if (settled) { return; }
			settled = true;
			const text = Buffer.concat(chunks).toString('utf8');
			if (text.trim() === '') { resolve({ ok: false, reason: 'empty' }); return; }
			try { resolve({ ok: true, data: JSON.parse(text) }); }
			catch { resolve({ ok: false, reason: 'invalid' }); }
		});
		req.on('error', () => resolve({ ok: false, reason: 'invalid' }));
		req.on('aborted', () => resolve({ ok: false, reason: 'invalid' }));
	});
}

/**
 * @brief Reads a bounded JSON payload and reports transport errors.
 * @param req Incoming request.
 * @param res Response stream.
 * @param limit Maximum accepted bytes.
 * @return Parsed value or undefined on error.
 */
export async function readBody(req: IncomingMessage, res: ServerResponse,
	limit: number = BODY_LIMIT): Promise<{ data: unknown } | null> {
	const body = await readJsonBody(req, limit);
	if (body.ok) { return { data: body.data }; }
	sendJson(res, body.reason === 'too_large' ? 413 : 400, {
		error: body.reason === 'too_large' ? 'too_large' : 'validation',
		message: `invalid body: ${body.reason}`
	} satisfies ErrorPayload);
	return null;
}
