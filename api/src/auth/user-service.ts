/**
 * @file user-service.ts
 * @brief Explicit CLI-only administrator creation without overwriting existing accounts.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { UserRepository } from '../db/repositories.js';
import { usernameField } from './credentials.js';
import { hashPassword } from './password.js';

const userInput = z.object({
	username: usernameField,
	email: z.email().max(254).optional(),
	name: z.string().trim().min(1).max(200).optional(),
	password: z.string().min(1).max(200)
});

/**
 * @brief Creates an administrator only when its username and email are unused.
 * @param users User persistence.
 * @param input Untrusted CLI input received through standard input, not command arguments.
 * @return Whether a new user was created, or an existing identity prevented changes.
 */
export async function createAdministrator(users: UserRepository, input: unknown): Promise<'created' | 'exists'> {
	const parsed = userInput.parse(input);
	const email = (parsed.email ?? `${parsed.username}@local.invalid`).toLowerCase();
	const existing = await users.findByUsername(parsed.username) ?? await users.findByEmail(email);
	if (existing !== null) { return 'exists'; }
	await users.create({
		id: randomUUID(), username: parsed.username, email,
		name: parsed.name ?? parsed.username, role: 'admin',
		passwordHash: await hashPassword(parsed.password)
	});
	return 'created';
}
