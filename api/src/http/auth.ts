/**
 * @file auth.ts
 * @brief Session resolution and authentication endpoint handlers.
 */
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loginSchema } from '../auth/credentials.js';
import type { UserRow } from '../db/schema.js';
import { buildSessionExpiry, clearSessionCookieHeader, createSessionToken, hashToken,
	parseCookies, SESSION_COOKIE, sessionCookieHeader } from '../auth/session.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { flattenIssues } from '../markdown/schema.js';
import { apiMessage } from '../i18n/index.js';
import type { ApiDeps, ApiHandler } from './types.js';
import { readBody, sendJson } from './response.js';

let dummyHash: Promise<string> | undefined;

/**
 * @brief Maps an owner to public fields, never exposing credentials.
 * @param user Owner row.
 * @return Public owner.
 */
export function userDto(user: UserRow) {
	return { id: user.id, email: user.email, username: user.username, name: user.name,
		role: user.role, isActive: user.isActive, createdAt: user.createdAt.toISOString() };
}

/**
 * @brief Resolves an unexpired session.
 * @param req Incoming request.
 * @param deps Repositories.
 * @return Session owner or null.
 */
export async function getSessionUser(req: IncomingMessage, deps: ApiDeps): Promise<UserRow | null> {
	const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
	if (!token) { return null; }
	const session = await deps.sessions.findByTokenHash(hashToken(token));
	if (!session) { return null; }
	if (!session.user.isActive || session.userVersion !== session.user.sessionVersion) { return null; }
	if (session.expiresAt <= new Date()) {
		await deps.sessions.deleteByTokenHash(session.tokenHash);
		return null;
	}
	return session.user;
}

/**
 * @brief Requires an administrator, not merely an authenticated reader.
 * @param req Incoming request.
 * @param res Response stream.
 * @param deps Repositories.
 * @return Administrator or null after a denial.
 */
export async function requireUser(req: IncomingMessage, res: ServerResponse, deps: ApiDeps): Promise<UserRow | null> {
	const user = await getSessionUser(req, deps);
	if (!user) { sendJson(res, 401, { error: 'unauthorized' }); return null; }
	if (user.role !== 'admin') { sendJson(res, 403, { error: 'forbidden' }); return null; }
	return user;
}

/**
 * @brief Validates credentials, equalizing work for unknown email addresses.
 * @param req Incoming request.
 * @param res Response stream.
 * @param deps Repositories and cookie policy.
 * @return Nothing.
 */
export const handleLogin: ApiHandler = async (req, res, deps) => {
	const body = await readBody(req, res);
	if (!body) { return; }
	const parsed = loginSchema.safeParse(body.data);
	if (!parsed.success) {
		sendJson(res, 400, { error: 'validation', issues: flattenIssues(parsed.error) }); return;
	}
	const identifier = parsed.data.email ?? parsed.data.username ?? '';
	const user = identifier.includes('@') ? await deps.users.findByEmail(identifier.toLowerCase())
		: await deps.users.findByUsername(identifier);
	dummyHash ??= hashPassword(randomUUID());
	const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? await dummyHash);
	if (!valid || !user || !user.isActive) {
		sendJson(res, 401, { error: 'unauthorized', message: apiMessage(req, 'auth.invalid_credentials') }); return;
	}
	const session = createSessionToken();
	await deps.sessions.create({ id: randomUUID(), tokenHash: session.tokenHash, userId: user.id,
		userVersion: user.sessionVersion, expiresAt: buildSessionExpiry() });
	sendJson(res, 200, { user: userDto(user) }, { 'set-cookie': sessionCookieHeader(session.token, deps.cookieSecure) });
};

/**
 * @brief Revokes the presented session and clears its cookie.
 * @param req Incoming request.
 * @param res Response stream.
 * @param deps Repositories.
 * @return Nothing.
 */
export const handleLogout: ApiHandler = async (req, res, deps) => {
	const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
	if (token) { await deps.sessions.deleteByTokenHash(hashToken(token)); }
	sendJson(res, 200, { ok: true }, { 'set-cookie': clearSessionCookieHeader() });
};

/**
 * @brief Returns an authenticated session owner.
 * @param req Incoming request.
 * @param res Response stream.
 * @param deps Repositories.
 * @return Nothing.
 */
export const handleMe: ApiHandler = async (req, res, deps) => {
	const user = await getSessionUser(req, deps);
	sendJson(res, user ? 200 : 401, user ? { user: userDto(user) } : { error: 'unauthorized' });
};
