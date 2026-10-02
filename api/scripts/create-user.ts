/**
 * @file create-user.ts
 * @brief Provision one administrator from private JSON stdin, never from logged arguments or .env.
 */
import { getDb } from '../src/db/client.js';
import { createDrizzleRepos } from '../src/db/drizzle.js';
import { createAdministrator } from '../src/auth/user-service.js';
import { parseCredentialJson } from '../src/auth/credentials.js';

let stage = 'input';
/**
 * @brief Reads bounded credential JSON without echoing it.
 * @return Untrusted parsed input.
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
 * @brief Executes an explicitly requested account provision operation.
 * @return Nothing.
 */
async function main(): Promise<void> {
	const input = await readInput();
	stage = 'database';
	const result = await createAdministrator(createDrizzleRepos(getDb()).users, input);
	process.stdout.write(result === 'created'
		? 'administrator created; credentials were not printed\n'
		: 'existing account left unchanged; credentials were not printed\n');
}

main().then(() => process.exit(0)).catch((error: unknown) => {
	const kind = error instanceof Error ? error.name : 'unknown';
	process.stderr.write(`administrator creation failed at ${stage} (${kind}); credentials were not printed\n`);
	process.exit(1);
});
