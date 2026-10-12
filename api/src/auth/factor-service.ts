/**
 * @file factor-service.ts
 * @brief Password confirmation, administrator enrollment and replay-safe factor verification.
 */
import { z } from 'zod';
import type { SecurityRepository } from '../db/security-repository.js';
import type { UserRow } from '../db/schema.js';
import { verifyPassword } from './password.js';
import { createEnrollment, enrollmentSecret, factorConfirmationSchema, openFactor,
	sealFactor, totpCodeSchema, verifiedTotpStep } from './totp.js';

export const factorRemovalSchema = z.object({
	password: z.string().min(1).max(200),
	code: totpCodeSchema
}).strict();
type FactorResult = 'ok' | 'unauthorized' | 'conflict';

/** @brief Starts password-confirmed administrator setup. @param security Persistence. @param user Owner. @param password Confirmation. @param key Encryption key. @return Setup, denial or conflict. */
export async function beginFactorSetup(security: SecurityRepository, user: UserRow, password: string, key: string) {
	if (user.role !== 'admin' || !await verifyPassword(password, user.passwordHash)) { return 'unauthorized'; }
	if (await security.findTotp(user.id)) { return 'conflict'; }
	const enrollment = createEnrollment(user.id, user.sessionVersion, key);
	const label = encodeURIComponent(`BenchCore:${user.email}`);
	const uri = `otpauth://totp/${label}?secret=${enrollment.secret}&issuer=BenchCore&algorithm=SHA1&digits=6&period=30`;
	return { ...enrollment, uri };
}

/** @brief Activates a verified owner-bound setup ticket. @param security Persistence. @param user Owner. @param input Validated form. @param key Key. @return Outcome. */
export async function enableFactor(security: SecurityRepository, user: UserRow,
	input: z.infer<typeof factorConfirmationSchema>, key: string): Promise<FactorResult> {
	const secret = enrollmentSecret(input.ticket, user.id, user.sessionVersion, key);
	const step = secret ? verifiedTotpStep(secret, input.code) : null;
	if (user.role !== 'admin' || !secret || step === null || !await verifyPassword(input.password, user.passwordHash)) { return 'unauthorized'; }
	const sealed = sealFactor(secret, key, `totp:${user.id}`);
	return await security.enableTotp(user.id, user.sessionVersion, user.passwordHash, sealed, step) ? 'ok' : 'conflict';
}

/** @brief Disables a factor using password and a fresh code. @param security Persistence. @param user Owner. @param input Validated form. @param key Key. @return Outcome. */
export async function disableFactor(security: SecurityRepository, user: UserRow,
	input: z.infer<typeof factorRemovalSchema>, key: string): Promise<FactorResult> {
	const factor = await security.findTotp(user.id);
	const secret = factor ? openFactor(factor.sealedSecret, key, `totp:${user.id}`) : null;
	const step = secret ? verifiedTotpStep(secret, input.code) : null;
	if (step === null || !await verifyPassword(input.password, user.passwordHash)) { return 'unauthorized'; }
	return await security.disableTotp(user.id, user.sessionVersion, user.passwordHash, step) ? 'ok' : 'conflict';
}

/** @brief Requires and consumes an existing factor without allowing key-loss bypass. @param security Persistence. @param user Password-verified owner. @param code Optional code. @param key Optional key. @return Whether login may proceed. */
export async function verifyLoginFactor(security: SecurityRepository, user: UserRow,
	code: string | undefined, key: string | undefined): Promise<boolean> {
	const factor = await security.findTotp(user.id);
	if (!factor) { return true; }
	const secret = key ? openFactor(factor.sealedSecret, key, `totp:${user.id}`) : null;
	const step = secret && code ? verifiedTotpStep(secret, code) : null;
	return step !== null && await security.consumeTotp(user.id, user.sessionVersion, step);
}
