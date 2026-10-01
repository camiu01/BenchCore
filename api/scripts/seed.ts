/**
 * @file seed.ts
 * @brief Bootstraps the admin user from the environment, then imports content.
 */
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../src/auth/password.js';
import { getDb } from '../src/db/client.js';
import { createDrizzleRepos } from '../src/db/drizzle.js';
import { importDirectory } from '../src/posts/import-service.js';

const email = process.env['ADMIN_EMAIL']?.toLowerCase();
const password = process.env['ADMIN_PASSWORD'];
const name = process.env['ADMIN_NAME'] ?? 'Admin';
if (email === undefined || email === '' || password === undefined || password === '') {
	process.stderr.write('ADMIN_EMAIL and ADMIN_PASSWORD are required\n');
	process.exit(1);
}

const repos = createDrizzleRepos(getDb());
const existing = await repos.users.findByEmail(email);
if (existing === null) {
	await repos.users.create({
		id: randomUUID(),
		email,
		passwordHash: await hashPassword(password),
		name,
		role: 'admin'
	});
	process.stdout.write(`admin created: ${email}\n`);
} else {
	process.stdout.write(`admin exists: ${email}\n`);
}

const defaultDir = fileURLToPath(new URL('../../content/posts', import.meta.url));
const dir = process.env['CONTENT_DIR'] ?? defaultDir;
const admin = (await repos.users.findByEmail(email)) ?? existing;
if (admin === null) {
	process.stderr.write('admin user missing after bootstrap\n');
	process.exit(1);
}
const result = await importDirectory(dir, repos, admin.id);
process.stdout.write(`import: ${result.created.length} created, ${result.updated.length} updated\n`);
for (const failure of result.errors) {
	process.stderr.write(`error ${failure.file}: ${failure.message}\n`);
}
process.exit(result.errors.length > 0 ? 1 : 0);
