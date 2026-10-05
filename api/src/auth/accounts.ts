/**
 * @file accounts.ts
 * @brief Validated registration, safe user management and authenticated password changes.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { UserRepository } from '../db/repositories.js';
import type { UserRow } from '../db/schema.js';
import { usernameField } from './credentials.js';
import { hashPassword, verifyPassword } from './password.js';

export const registrationSchema = z.object({
	username: usernameField,
	email: z.email().max(254).transform((value) => value.toLowerCase()),
	name: z.string().trim().min(1).max(200),
	password: z.string().min(8).max(200)
}).strict();
export const passwordChangeSchema = z.object({
	currentPassword: z.string().min(1).max(200),
	newPassword: z.string().min(8).max(200)
}).strict().refine((input) => input.currentPassword !== input.newPassword, 'choose a different password');
export const userPatchSchema = z.object({
	role: z.enum(['admin', 'reader']).optional(),
	isActive: z.boolean().optional()
}).strict().refine((patch) => patch.role !== undefined || patch.isActive !== undefined, 'provide a change');

/**
 * @brief Creates a public reader or an explicitly selected admin-managed role.
 * @param users Persistence.
 * @param input Validated registration.
 * @param role Server-selected role, never taken from public input.
 * @return Owner or null when identity is unavailable.
 */
export async function registerUser(users: UserRepository, input: z.infer<typeof registrationSchema>,
	role: 'reader' | 'admin' = 'reader'): Promise<UserRow | null> {
	if (await users.findByUsername(input.username) || await users.findByEmail(input.email)) { return null; }
	try {
		return await users.create({ id: randomUUID(), username: input.username, email: input.email, name: input.name,
			passwordHash: await hashPassword(input.password), role });
	} catch (error) {
		const collision = await users.findByUsername(input.username) ?? await users.findByEmail(input.email);
		if (collision) { return null; }
		throw error;
	}
}

/**
 * @brief Verifies the current password, then atomically rotates it and invalidates all sessions.
 * @param users Persistence.
 * @param user Authenticated owner.
 * @param input Validated password pair.
 * @return Whether the password changed.
 */
export async function changeOwnPassword(users: UserRepository, user: UserRow,
	input: z.infer<typeof passwordChangeSchema>): Promise<boolean> {
	if (!await verifyPassword(input.currentPassword, user.passwordHash)) { return false; }
	return users.changePassword(user.id, user.passwordHash, await hashPassword(input.newPassword));
}
