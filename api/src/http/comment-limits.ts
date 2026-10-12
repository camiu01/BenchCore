/**
 * @file comment-limits.ts
 * @brief Bounded, independent IP and session submission quotas without storing raw tokens.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { hashToken, parseCookies, SESSION_COOKIE } from '../auth/session.js';
import { sendJson } from './response.js';
import type { ApiDeps } from './types.js';

/** @brief Creates instance-local comment quotas. @param deps Address policy and limits. @return Submission guard. */
export function createCommentGuard(deps: ApiDeps) {
	const states = new Map<string, { count: number; reset: number }>();
	const limit = deps.rateLimit?.commentRequests ?? 5;
	const windowMs = deps.rateLimit?.windowMs ?? 60_000;
	const maximum = deps.rateLimit?.maxClients ?? 10_000;
	/** @brief Reserves both IP and session quotas. @param req Request. @param res Response. @return Whether accepted. */
	return (req: IncomingMessage, res: ServerResponse): boolean => {
		const now = Date.now();
		const address = deps.clientAddress?.(req) ?? req.socket.remoteAddress ?? 'unknown';
		const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
		const keys = [`ip:${address}`];
		if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) { keys.push(`session:${hashToken(token)}`); }
		if (states.size + keys.filter((key) => !states.has(key)).length > maximum) {
			for (const [key, state] of states) { if (state.reset <= now) { states.delete(key); } }
		}
		if (states.size + keys.filter((key) => !states.has(key)).length > maximum) {
			sendJson(res, 429, { error: 'rate_limited' }, { 'retry-after': String(Math.ceil(windowMs / 1000)) }); return false;
		}
		for (const key of keys) {
			const old = states.get(key);
			const state = old && old.reset > now ? old : { count: 0, reset: now + windowMs };
			states.set(key, state);
			if (state.count >= limit) {
				sendJson(res, 429, { error: 'rate_limited' }, { 'retry-after': String(Math.max(1, Math.ceil((state.reset - now) / 1000))) });
				return false;
			}
		}
		for (const key of keys) { states.get(key)!.count += 1; }
		return true;
	};
}
