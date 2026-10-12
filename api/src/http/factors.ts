/**
 * @file factors.ts
 * @brief Password-confirmed administrator TOTP enrollment and fresh-code factor removal.
 */
import { factorConfirmationSchema, factorPasswordSchema } from '../auth/totp.js';
import { beginFactorSetup, disableFactor, enableFactor, factorRemovalSchema } from '../auth/factor-service.js';
import { clearSessionCookieHeader } from '../auth/session.js';
import { requireUser } from './auth.js';
import { readBody, sendJson } from './response.js';
import type { ApiHandler } from './types.js';

/** @brief Reports factor state without returning secret material. @param req Request. @param res Response. @param deps Dependencies. @return Completion. */
export const handleFactorStatus: ApiHandler = async (req, res, deps) => {
	const user = await requireUser(req, res, deps);
	if (!user) { return; }
	sendJson(res, 200, { enabled: !!await deps.security.findTotp(user.id), available: !!deps.totpKey });
};

/** @brief Starts password-confirmed enrollment. @param req Request. @param res Response. @param deps Dependencies. @return Completion. */
export const handleFactorEnrollment: ApiHandler = async (req, res, deps) => {
	const user = await requireUser(req, res, deps);
	if (!user) { return; }
	if (!deps.totpKey) { sendJson(res, 503, { error: 'internal' }); return; }
	const body = await readBody(req, res);
	if (!body) { return; }
	const parsed = factorPasswordSchema.safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
	const result = await beginFactorSetup(deps.security, user, parsed.data.password, deps.totpKey);
	if (typeof result === 'string') {
		sendJson(res, result === 'unauthorized' ? 401 : 409, { error: result }); return;
	}
	sendJson(res, 200, result);
};

/** @brief Confirms enrollment with a real authenticator code. @param req Request. @param res Response. @param deps Dependencies. @return Completion. */
export const handleFactorEnable: ApiHandler = async (req, res, deps) => {
	const user = await requireUser(req, res, deps);
	if (!user) { return; }
	if (!deps.totpKey) { sendJson(res, 503, { error: 'internal' }); return; }
	const body = await readBody(req, res);
	if (!body) { return; }
	const parsed = factorConfirmationSchema.safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
	const result = await enableFactor(deps.security, user, parsed.data, deps.totpKey);
	const status = result === 'ok' ? 200 : result === 'unauthorized' ? 401 : 409;
	sendJson(res, status, result === 'ok' ? { ok: true } : { error: result },
		result === 'ok' ? { 'set-cookie': clearSessionCookieHeader() } : undefined);
};

/** @brief Removes a factor with password and a non-replayed code. @param req Request. @param res Response. @param deps Dependencies. @return Completion. */
export const handleFactorDisable: ApiHandler = async (req, res, deps) => {
	const user = await requireUser(req, res, deps);
	if (!user) { return; }
	if (!deps.totpKey) { sendJson(res, 503, { error: 'internal' }); return; }
	const body = await readBody(req, res);
	if (!body) { return; }
	const parsed = factorRemovalSchema.safeParse(body.data);
	if (!parsed.success) { sendJson(res, 400, { error: 'validation' }); return; }
	const result = await disableFactor(deps.security, user, parsed.data, deps.totpKey);
	const status = result === 'ok' ? 200 : result === 'unauthorized' ? 401 : 409;
	sendJson(res, status, result === 'ok' ? { ok: true } : { error: result },
		result === 'ok' ? { 'set-cookie': clearSessionCookieHeader() } : undefined);
};
