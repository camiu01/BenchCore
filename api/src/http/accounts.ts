/**
 * @file accounts.ts
 * @brief Reader registration, own password changes and administrator-only user management.
 */
import { z } from 'zod';
import { changeOwnPassword, passwordChangeSchema, registerUser, registrationSchema, userPatchSchema } from '../auth/accounts.js';
import {
	consumePasswordReset,
	issuePasswordReset,
	passwordResetRequestSchema,
	passwordResetSchema
} from '../auth/password-reset.js';
import { clearSessionCookieHeader } from '../auth/session.js';
import type { ApiHandler } from './types.js';
import { getSessionUser, requireUser, userDto } from './auth.js';
import { readBody, sendJson } from './response.js';

/**
 * @brief Registers a reader without creating an automatic session or admin privilege.
 * @param req Request. @param res Response. @param deps Dependencies.
 * @return Completion.
 */
export const handleRegister: ApiHandler = async (req, res, deps) => {
	const body = await readBody(req, res);
	if (!body) { return; }
	const parsed = registrationSchema.safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation', message: 'Valid identity and an 8+ character password are required' }); return; }
	const user = await registerUser(deps.users, parsed.data);
	sendJson(res, user ? 201 : 409, user ? { user: userDto(user) } : { error: 'conflict', message: 'Account details unavailable' });
};

/**
 * @brief Changes only the authenticated owner's password, then requires a new login.
 * @param req Request. @param res Response. @param deps Dependencies.
 * @return Completion.
 */
export const handleChangePassword: ApiHandler = async (req, res, deps) => {
	const user = await getSessionUser(req, deps);
	if (!user) { sendJson(res, 401, { error: 'unauthorized' }); return; }
	const body = await readBody(req, res);
	if (!body) { return; }
	const parsed = passwordChangeSchema.safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation', message: 'Use a different 8+ character password' }); return; }
	if (!await changeOwnPassword(deps.users, user, parsed.data)) { sendJson(res, 400, { error: 'validation', message: 'Current password is incorrect or account changed' }); return; }
	sendJson(res, 200, { ok: true }, { 'set-cookie': clearSessionCookieHeader() });
};

/**
 * @brief Sends a recovery link while returning the same response for every valid email.
 * @param req Request. @param res Response. @param deps Dependencies.
 * @return Completion.
 */
export const handlePasswordResetRequest: ApiHandler = async (req, res, deps) => {
	const body = await readBody(req, res);
	if (!body) { return; }
	const parsed = passwordResetRequestSchema.safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
	if (!deps.passwordReset) { sendJson(res, 503, { error: 'internal' }); return; }
	const issued = await issuePasswordReset(deps.users, parsed.data.email);
	if (issued) {
		const resetUrl = `${deps.passwordReset.siteUrl}/reset-password?token=${encodeURIComponent(issued.token)}`;
		await deps.passwordReset.delivery.send(issued.user, resetUrl).catch(() => undefined);
	}
	sendJson(res, 202, { ok: true });
};

/**
 * @brief Consumes a live recovery token and revokes every owner session.
 * @param req Request. @param res Response. @param deps Dependencies.
 * @return Completion.
 */
export const handlePasswordReset: ApiHandler = async (req, res, deps) => {
	const body = await readBody(req, res);
	if (!body) { return; }
	const parsed = passwordResetSchema.safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
	const changed = await consumePasswordReset(deps.users, parsed.data.token, parsed.data.newPassword);
	sendJson(res, changed ? 200 : 400, changed
		? { ok: true }
		: { error: 'validation', message: 'Reset link is invalid or expired' });
};

/**
 * @brief Lists, creates or changes accounts after an administrator check.
 * @param req Request. @param res Response. @param deps Dependencies. @param url Query. @param key Owner id.
 * @return Completion.
 */
export const handleUsers: ApiHandler = async (req, res, deps, url, key) => {
	const actor = await requireUser(req, res, deps);
	if (!actor) { return; }
	if (req.method === 'GET') {
		const page = z.object({ limit: z.coerce.number().int().min(1).max(100), offset: z.coerce.number().int().min(0).max(100_000) })
			.safeParse({ limit: url.searchParams.get('limit') ?? 25, offset: url.searchParams.get('offset') ?? 0 });
		if (!page.success) { sendJson(res, 400, { error: 'validation' }); return; }
		const result = await deps.users.listPage(page.data.limit, page.data.offset);
		sendJson(res, 200, { ...result, items: result.items.map(userDto) }); return;
	}
	const body = await readBody(req, res);
	if (!body) { return; }
	if (req.method === 'POST') {
		const parsed = registrationSchema.extend({ role: z.enum(['admin', 'reader']) }).safeParse(body.data);
		if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
		const user = await registerUser(deps.users, parsed.data, parsed.data.role);
		sendJson(res, user ? 201 : 409, user ? { user: userDto(user) } : { error: 'conflict' }); return;
	}
	const parsed = userPatchSchema.safeParse(body.data);
	if (!z.uuid().safeParse(key).success || !parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
	const patch = { ...(parsed.data.role === undefined ? {} : { role: parsed.data.role }),
		...(parsed.data.isActive === undefined ? {} : { isActive: parsed.data.isActive }) };
	const result = await deps.users.manage(actor.id, key, patch);
	if (result === 'forbidden') { sendJson(res, 403, { error: 'forbidden' }); return; }
	if (result === 'last_admin') { sendJson(res, 409, { error: 'conflict', message: 'Keep at least one active administrator' }); return; }
	sendJson(res, result ? 200 : 404, result ? { user: userDto(result) } : { error: 'not_found' });
};
