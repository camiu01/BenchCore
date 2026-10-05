/**
 * @file account.ts
 * @brief Production account creation or explicit password rotation from bounded private stdin.
 */
import { z } from 'zod';
import { parseCredentialJson, usernameField } from '../auth/credentials.js';
import { createAdministrator } from '../auth/user-service.js';
import { hashPassword } from '../auth/password.js';
import { closeDb, getDb } from '../db/client.js';
import { createDrizzleUsers } from '../db/drizzle.js';
import { rotatePassword } from '../db/account-maintenance.js';

const inputSchema = z.object({
	username: usernameField,
	password: z.string().min(8).max(200),
	email: z.email().max(254).optional(),
	name: z.string().trim().min(1).max(200).optional()
});

/**
 * @brief Reads credentials without echoing them or accepting password arguments.
 * @return Parsed untrusted input.
 */
async function readInput(): Promise<unknown> {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of process.stdin) {
		const data = Buffer.from(chunk);
		size += data.length;
		if (size > 8192) { throw new Error('input too large'); }
		chunks.push(data);
	}
	return parseCredentialJson(Buffer.concat(chunks).toString('utf8'));
}

/**
 * @brief Performs only the operator-selected operation and never creates identities on startup.
 * @return Completion.
 */
async function main(): Promise<void> {
	const mode = process.argv[2];
	if (mode !== 'create' && mode !== 'password') { throw new Error('select create or password'); }
	const input = inputSchema.parse(await readInput());
	const db = getDb();
	const result = mode === 'create' ? await createAdministrator(createDrizzleUsers(db), input)
		: await rotatePassword(db, input.username, await hashPassword(input.password)) ? 'rotated' : 'not found';
	process.stdout.write(`account operation: ${result}; credentials were not printed\n`);
	if (result === 'not found') { process.exitCode = 1; }
}

main().catch(() => {
	process.stderr.write('Account operation failed; verify input (8+ character password) and database access\n');
	process.exitCode = 1;
}).finally(closeDb);
