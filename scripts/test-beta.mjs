/**
 * @file test-beta.mjs
 * @brief Destructive-free unified-runtime smoke against a guarded, isolated test database.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const root = fileURLToPath(new URL('..', import.meta.url));
const bundleMode = process.argv.includes('--bundle');
const app = bundleMode ? resolve(root, process.env['BETA_BUNDLE'] ?? 'missing-bundle') : root;

/**
 * @brief Reserves a currently available loopback port for the disposable test child.
 * @return {Promise<number>} Port.
 */
async function availablePort() {
	const server = createServer();
	await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(undefined)));
	const address = server.address();
	assert(address && typeof address !== 'string');
	await new Promise((resolve) => server.close(resolve));
	return address.port;
}

/**
 * @brief Refuses all nonlocal or non-test database targets before any writes.
 * @return {void} Completion.
 */
function guardDatabase() {
	const url = new URL(process.env['DATABASE_URL'] ?? '');
	assert(['postgres:', 'postgresql:'].includes(url.protocol));
	assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
	assert(/^[a-z0-9_]+_test$/.test(url.pathname.slice(1)), 'Use a dedicated local *_test database');
}

/**
 * @brief Verifies the assembled archive cannot contain top-level private state.
 * @return {Promise<void>} Completion.
 */
async function checkBundle() {
	const allowed = new Set(['api', 'frontend', 'runtime', 'package.json', 'README.md', 'LICENSE', 'CHANGELOG.md', '.env.production.example']);
	for (const entry of await readdir(app)) { assert(allowed.has(entry), 'Unexpected bundle entry'); }
	const manifest = JSON.parse(await readFile(join(app, 'package.json'), 'utf8'));
	assert(!manifest.dependencies && !manifest.devDependencies);
	assert.equal(manifest.scripts.start, 'node --env-file-if-exists=.env runtime/server.mjs');
	for (const name of ['api', 'frontend']) {
		const entries = await readdir(join(app, name));
		assert(!entries.includes('src') && !entries.includes('tests') && !entries.includes('.env'));
	}
}

/**
 * @brief Runs an explicit built CLI without echoing private stdin or database errors.
 * @param {string} entry Relative entry.
 * @param {string[]} args Arguments without credentials.
 * @param {string} [input] Private JSON.
 * @return {void} Completion.
 */
function cli(entry, args, input) {
	const result = spawnSync(process.execPath, [join(app, entry), ...args], {
		cwd: app, env: { ...process.env, NODE_ENV: 'production', MEDIA_STORAGE: 'database' }, input, encoding: 'utf8', timeout: 30_000
	});
	assert.equal(result.status, 0, 'Built account/migration CLI failed (details withheld)');
}

/**
 * @brief Performs HTTP, reader isolation, account changes and browser-action checks.
 * @param {string} base Origin.
 * @param {string} admin Username.
 * @param {string} password Fixture password.
 * @return {Promise<void>} Completion.
 */
async function scenarios(base, admin, password) {
	/**
	 * @brief Sends fixed JSON fixtures to the beta.
	 * @param {string} path API path. @param {string} method Method.
	 * @param {unknown} [body] Fixture. @param {string} [cookie] Session.
	 * @return {Promise<Response>} Response.
	 */
	const request = (path, method, body, cookie) => fetch(base + path, {
		method, headers: { origin: base, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
		body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(10_000)
	});
	for (const path of ['/', '/posts', '/login', '/register', '/health/live', '/health/ready', '/api/posts']) {
		assert.equal((await fetch(base + path)).status, 200, `Route ${path} unavailable`);
	}
	assert.equal((await request('/api/auth/register', 'POST', { role: 'admin' })).status, 400);
	const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
	const reader = { username: `r${suffix}`, email: `r${suffix}@example.test`, name: 'Beta reader', password };
	const registration = await request('/api/auth/register', 'POST', reader);
	assert.equal(registration.status, 201);
	const registered = await registration.json();
	assert.equal(registered.user.role, 'reader');
	assert(!JSON.stringify(registered).includes('passwordHash'));
	const login = await request('/api/auth/login', 'POST', { username: reader.username, password });
	assert.equal(login.status, 200);
	const cookie = login.headers.getSetCookie()[0]?.split(';')[0];
	assert(cookie);
	assert.equal((await request('/api/admin/users', 'GET', undefined, cookie)).status, 403);
	assert.equal((await fetch(base + '/admin', { headers: { cookie }, redirect: 'manual' })).status, 403);
	assert.equal((await fetch(base + '/account', { headers: { cookie } })).status, 200);
	const adminLogin = await request('/api/auth/login', 'POST', { username: admin, password });
	const adminCookie = adminLogin.headers.getSetCookie()[0]?.split(';')[0];
	assert(adminCookie);
	await knowledgeScenarios(base, adminCookie);
	const users = await request('/api/admin/users', 'GET', undefined, adminCookie);
	assert.equal(users.status, 200);
	const disabled = await request(`/api/admin/users/${registered.user.id}`, 'PATCH', { isActive: false }, adminCookie);
	assert.equal(disabled.status, 200);
	assert.equal((await request('/api/auth/me', 'GET', undefined, cookie)).status, 401);
	assert.equal((await request(`/api/admin/users/${registered.user.id}`, 'PATCH', { isActive: true }, adminCookie)).status, 200);
	if (process.env['BETA_PG_CONCURRENCY'] === '1') {
		await concurrentAdminChanges(base, adminCookie, admin, password);
	}
	await browserPasswordChange(base, reader.username, password);
}

/** @brief Tests SQL tag grouping, ranking and lightweight preview privacy through the built runtime. @param {string} base Origin. @param {string} cookie Admin session. @return {Promise<void>} Completion. */
async function knowledgeScenarios(base, cookie) {
	const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
	const tag = `sql-${suffix}`;
	const headers = { origin: base, 'content-type': 'application/json', cookie };
	for (const [index, audience] of ['public', 'public', 'readers'].entries()) {
		const response = await fetch(base + '/api/posts', { method: 'POST', headers,
			body: JSON.stringify({ title: `Knowledge ${index}`, slug: `k${suffix}-${index}`, status: 'published', audience,
				tags: index === 0 ? [tag, `${tag}-extra`] : [tag], contentMarkdown: 'privatefixturebody',
				description: 'privatefixturesummary', publishedAt: `202${index}-01-01T00:00:00Z` }) });
		assert.equal(response.status, 201);
	}
	const query = `/api/posts?tag=${tag}&tag=${tag}-extra`;
	assert.equal((await (await fetch(base + query)).json()).total, 1);
	assert.equal((await (await fetch(base + query + '&tagMode=or&limit=1&offset=1')).json()).total, 3);
	for (const index of [0, 2, 2]) {
		assert.equal((await fetch(`${base}/api/posts/k${suffix}-${index}/likes`, { method: 'POST', headers })).status, 200);
	}
	/** @type {{items: {slug: string; likesCount: number}[]}} */
	const popular = await (await fetch(`${base}/api/posts?tag=${tag}&sort=popular`)).json();
	assert.equal(popular.items[0]?.slug, `k${suffix}-0`);
	assert.equal(popular.items.find((item) => item.slug === `k${suffix}-2`)?.likesCount, 0);
	/** @type {{total: number; items: {updatedAt: string}[]}} */
	const updated = await (await fetch(`${base}/api/posts?tag=${tag}&sort=updated`)).json();
	assert.equal(updated.total, 3);
	assert(updated.items.every((item) => typeof item.updatedAt === 'string'));
	const path = `${base}/api/posts/k${suffix}-2/preview`;
	const locked = await (await fetch(path)).json();
	assert.equal(locked.locked, true); assert.equal(locked.description, ''); assert.equal(locked.coverImage, null);
	const visible = await (await fetch(path, { headers: { cookie } })).json();
	assert.equal(visible.description, 'privatefixturesummary');
	assert(!JSON.stringify(visible).includes('privatefixturebody'));
	assert.equal((await fetch(`${base}/api/posts/missing-${suffix}/preview`)).status, 404);
	const archiveResponse = await fetch(`${base}/posts?tag=${tag}&tagMode=or&sort=popular`);
	assert.equal(archiveResponse.status, 200, 'Archive SSR failed');
	const archive = await archiveResponse.text();
	assert(archive.includes('Most liked'), 'Archive sort control missing');
	assert(archive.includes('Knowledge 0'), `Archive SQL fixture missing; offline=${archive.includes('Posts temporarily unavailable')}`);
}

/**
 * @brief Proves concurrent demotions cannot remove both final administrators on real PostgreSQL.
 * @param {string} base Origin. @param {string} cookie First admin. @param {string} first Username.
 * @param {string} password Fixture password.
 * @return {Promise<void>} Completion.
 */
async function concurrentAdminChanges(base, cookie, first, password) {
	const headers = { origin: base, 'content-type': 'application/json', cookie };
	const created = await fetch(base + '/api/admin/users', {
		method: 'POST', headers, body: JSON.stringify({ username: `b${first}`, email: `b${first}@example.test`,
			name: 'Second administrator', role: 'admin', password })
	});
	assert.equal(created.status, 201);
	const second = (await created.json()).user.id;
	const me = await fetch(base + '/api/auth/me', { headers: { cookie } });
	const firstId = (await me.json()).user.id;
	const login = await fetch(base + '/api/auth/login', {
		method: 'POST', headers, body: JSON.stringify({ username: `b${first}`, password })
	});
	const secondCookie = login.headers.getSetCookie()[0]?.split(';')[0];
	assert(secondCookie);
	const responses = await Promise.all([
		fetch(base + `/api/admin/users/${second}`, { method: 'PATCH', headers, body: '{"isActive":false}' }),
		fetch(base + `/api/admin/users/${firstId}`, { method: 'PATCH',
			headers: { ...headers, cookie: secondCookie }, body: '{"isActive":false}' })
	]);
	assert.equal(responses.filter((response) => response.status === 200).length, 1, 'Concurrent changes removed both administrators');
	assert(responses.some((response) => [401, 403, 409].includes(response.status)));
}

/**
 * @brief Exercises a real SvelteKit form action through the SSR bridge and checks revocation.
 * @param {string} base Origin. @param {string} username Reader. @param {string} password Old password.
 * @return {Promise<void>} Completion.
 */
async function browserPasswordChange(base, username, password) {
	const login = await fetch(base + '/api/auth/login', {
		method: 'POST', headers: { origin: base, 'content-type': 'application/json' },
		body: JSON.stringify({ username, password })
	});
	const cookie = login.headers.getSetCookie()[0]?.split(';')[0];
	assert(cookie);
	const form = new FormData();
	form.set('currentPassword', password);
	form.set('newPassword', `${password}-rotated`);
	form.set('confirmation', `${password}-rotated`);
	const changed = await fetch(base + '/account?/password', {
		method: 'POST', headers: { origin: base, cookie, accept: 'text/html' }, body: form, redirect: 'manual'
	});
	if (changed.status !== 303) {
		const text = await changed.text();
		const known = ['Check the fields', 'Sign in again', 'Account service unavailable', 'Use matching',
			'Forbidden origin', 'Cross-site'].filter((message) => text.includes(message)).join(', ');
		assert.fail(`SSR password form failed (${changed.status}; ${known || 'no known form error'})`);
	}
	assert.equal(changed.headers.get('location'), '/login?passwordChanged=1');
	assert.equal((await fetch(base + '/api/auth/me', { headers: { cookie } })).status, 401);
}

/**
 * @brief Starts and always stops its own server, never reading the user's .env.
 * @return {Promise<void>} Completion.
 */
async function main() {
	guardDatabase();
	if (bundleMode) { await checkBundle(); cli('api/dist/cli/migrate.js', []); }
	const admin = `a${randomUUID().replaceAll('-', '').slice(0, 12)}`;
	const password = `fixture-${randomUUID()}`;
	cli('api/dist/cli/account.js', ['create'], JSON.stringify({ username: admin, password }));
	cli('api/dist/cli/media.js', ['cleanup', '--dry-run']);
	const port = await availablePort();
	const base = `http://127.0.0.1:${port}`;
	const child = spawn(process.execPath, [join(app, 'runtime/server.mjs')], {
		cwd: app, env: { ...process.env, SITE_URL: base, NODE_ENV: 'production', HOST: '127.0.0.1',
			PORT: String(port), MEDIA_STORAGE: 'database', TRUSTED_PROXY_IPS: '' }, stdio: 'ignore'
	});
	try {
		let ready = false;
		for (let attempt = 0; attempt < 100; attempt++) {
			if (child.exitCode !== null) { throw new Error('Beta child stopped before readiness'); }
			try { ready = (await fetch(base + '/health/ready', { signal: AbortSignal.timeout(500) })).ok; } catch {}
			if (ready) { break; }
			await sleep(100);
		}
		assert(ready, 'Beta did not become ready');
		await scenarios(base, admin, password);
		process.stdout.write(`${bundleMode ? 'Packaged' : 'Source'} single-origin beta smoke passed\n`);
	} finally {
		child.kill('SIGTERM');
		await new Promise((resolve) => {
			if (child.exitCode !== null) { resolve(undefined); return; }
			const deadline = setTimeout(() => child.kill('SIGKILL'), 16_000);
			deadline.unref();
			child.once('exit', () => { clearTimeout(deadline); resolve(undefined); });
		});
	}
}

main().catch((error) => {
	const detail = error instanceof assert.AssertionError ? error.message : 'runtime or fixture setup failed';
	process.stderr.write(`Beta smoke failed: ${detail}\n`);
	process.exitCode = 1;
});
