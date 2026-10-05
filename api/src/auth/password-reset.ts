/**
 * @file password-reset.ts
 * @brief Single-use password recovery token creation and consumption.
 */
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { UserRepository } from '../db/repositories.js';
import { hashToken } from './session.js';
import { hashPassword } from './password.js';

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
export const passwordResetRequestSchema = z.object({
	email: z.email().max(254).transform((value) => value.toLowerCase())
}).strict();
export const passwordResetSchema = z.object({
	token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
	newPassword: z.string().min(8).max(200)
}).strict();

/**
 * @brief Issues a new recovery token for an active email owner.
 * @param users Persistence.
 * @param email Normalized email.
 * @param now Reference time.
 * @return Raw token and owner, or null for unavailable accounts.
 */
export async function issuePasswordReset(users: UserRepository, email: string, now: Date = new Date()) {
	const user = await users.findByEmail(email);
	if (!user?.isActive) { return null; }
	const token = randomBytes(32).toString('base64url');
	await users.createPasswordReset(user.id, hashToken(token), new Date(now.getTime() + PASSWORD_RESET_TTL_MS));
	return { token, user };
}

/**
 * @brief Consumes a valid token and changes the password.
 * @param users Persistence.
 * @param token Raw recovery token.
 * @param newPassword Replacement password.
 * @param now Reference time.
 * @return Whether the reset completed.
 */
export async function consumePasswordReset(users: UserRepository, token: string, newPassword: string,
	now: Date = new Date()): Promise<boolean> {
	return users.resetPassword(hashToken(token), await hashPassword(newPassword), now);
}
