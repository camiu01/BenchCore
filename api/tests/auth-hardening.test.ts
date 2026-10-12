/**
 * @file auth-hardening.test.ts
 * @brief End-to-end in-process factor, replay, revocation and audit authorization regressions.
 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createHandler } from '../src/server.js';
import { nodeHandlerFetch } from '../src/http/web.js';
import { hashPassword } from '../src/auth/password.js';
import { enrollmentSecret, openFactor, totpCode } from '../src/auth/totp.js';
import { createPost } from '../src/posts/post-service.js';
import { createTestDeps, createTestRepos } from './helpers.js';

const origin = 'http://localhost:5173';
const password = 'synthetic-long-password';
const key = 'a1'.repeat(32);
const enrollmentDto = z.object({ secret: z.string(), ticket: z.string() });
const historyDto = z.object({ items: z.array(z.object({ id: z.uuid() })), hasMore: z.boolean() });
let repos: ReturnType<typeof createTestRepos>;
let handler: ReturnType<typeof createHandler>;
let ownerId: string;
let now: number;

beforeEach(async () => {
	now = Math.floor(Date.now() / 30_000) * 30_000;
	vi.spyOn(Date, 'now').mockImplementation(() => now);
	repos = createTestRepos();
	ownerId = randomUUID();
	await repos.users.create({ id: ownerId, username: 'operator', email: 'operator@example.test', name: 'Operator',
		role: 'admin', passwordHash: await hashPassword(password) });
	handler = createHandler({ ...createTestDeps(repos), totpKey: key });
});
afterEach(() => { vi.restoreAllMocks(); });

/** @brief Executes the secured API without a listener. @param path Endpoint. @param method Verb. @param data JSON. @param cookie Session. @return Response. */
function request(path: string, method = 'GET', data?: unknown, cookie?: string) {
	return nodeHandlerFetch(handler, new Request(origin + path, { method,
		headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
		...(data === undefined ? {} : { body: JSON.stringify(data) })
	}), '203.0.113.1');
}
/** @brief Logs in with an optional factor code. @param code Code. @param username Owner. @return Response. */
function login(code?: string, username = 'operator') {
	return request('/api/auth/login', 'POST', { username, password, ...(code ? { code } : {}) });
}
/** @brief Extracts a successful synthetic session. @param response Login. @return Cookie. */
function cookie(response: Response): string {
	expect(response.status).toBe(200);
	return response.headers.getSetCookie()[0]!.split(';')[0]!;
}
/** @brief Enrolls and enables the fixture administrator. @param session Current cookie. @return Hex test secret. */
async function enable(session: string): Promise<string> {
	const response = await request('/api/auth/totp/enroll', 'POST', { password }, session);
	expect(response.status).toBe(200);
	const enrollment = enrollmentDto.parse(await response.json());
	const secret = enrollmentSecret(enrollment.ticket, ownerId, 0, key)!;
	expect(await repos.security.findTotp(ownerId)).toBeNull();
	expect((await request('/api/auth/totp/enable', 'POST', {
		password, ticket: enrollment.ticket, code: totpCode(secret, Math.floor(now / 30_000))
	}, session)).status).toBe(200);
	return secret;
}

describe('authentication hardening', () => {
	it('revokes all device sessions while leaving a fresh login possible', async () => {
		const first = cookie(await login());
		const second = cookie(await login());
		const result = await request('/api/auth/logout/all', 'POST', {}, first);
		expect(result.status).toBe(200);
		expect(result.headers.get('set-cookie')).toContain('Max-Age=0');
		for (const session of [first, second]) {
			expect((await request('/api/auth/me', 'GET', undefined, session)).status).toBe(401);
		}
		expect(cookie(await login())).toBeTruthy();
		expect((await repos.security.listEvents(0)).some((event) => event.action === 'sessions.revoked')).toBe(true);
	});
	it('keeps ordinary logout scoped to the presented device', async () => {
		const first = cookie(await login());
		const second = cookie(await login());
		expect((await request('/api/auth/logout', 'POST', {}, first)).status).toBe(200);
		expect((await request('/api/auth/me', 'GET', undefined, first)).status).toBe(401);
		expect((await request('/api/auth/me', 'GET', undefined, second)).status).toBe(200);
	});
	it('requires a code after activation, encrypts stored secrets and rejects every old session', async () => {
		const first = cookie(await login());
		const second = cookie(await login());
		const secret = await enable(first);
		const stored = (await repos.security.findTotp(ownerId))!;
		expect(stored.sealedSecret).not.toContain(secret);
		expect(openFactor(stored.sealedSecret, key, `totp:${ownerId}`)).toBe(secret);
		expect((await login()).status).toBe(401);
		expect((await login(totpCode(secret, Math.floor(now / 30_000)))).status).toBe(401);
		for (const session of [first, second]) {
			expect((await request('/api/auth/me', 'GET', undefined, session)).status).toBe(401);
		}
		now += 30_000;
		const fresh = cookie(await login(totpCode(secret, Math.floor(now / 30_000))));
		expect((await request('/api/admin/audit', 'GET', undefined, fresh)).status).toBe(200);
	});
	it('consumes a factor code only once under concurrent login requests', async () => {
		const secret = await enable(cookie(await login()));
		now += 30_000;
		const code = totpCode(secret, Math.floor(now / 30_000));
		const results = await Promise.all([login(code), login(code)]);
		expect(results.map((response) => response.status).sort()).toEqual([200, 401]);
		expect((await login(code)).headers.getSetCookie()).toEqual([]);
	});
	it('requires a fresh factor and password to disable, then revokes sessions', async () => {
		const secret = await enable(cookie(await login()));
		now += 30_000;
		const session = cookie(await login(totpCode(secret, Math.floor(now / 30_000))));
		const reused = await request('/api/auth/totp/disable', 'POST', {
			password, code: totpCode(secret, Math.floor(now / 30_000))
		}, session);
		expect(reused.status).toBe(409);
		now += 30_000;
		const data = { password, code: totpCode(secret, Math.floor(now / 30_000)) };
		expect((await request('/api/auth/totp/disable', 'POST', { ...data, password: 'wrong' }, session)).status).toBe(401);
		expect((await request('/api/auth/totp/disable', 'POST', data, session)).status).toBe(200);
		expect(await repos.security.findTotp(ownerId)).toBeNull();
		expect((await request('/api/auth/me', 'GET', undefined, session)).status).toBe(401);
		expect(cookie(await login())).toBeTruthy();
	});
	it('rejects unconfirmed, expired and foreign enrollment tickets', async () => {
		const session = cookie(await login());
		expect((await request('/api/auth/totp/enroll', 'POST', { password: 'wrong' }, session)).status).toBe(401);
		const response = await request('/api/auth/totp/enroll', 'POST', { password }, session);
		const enrollment = enrollmentDto.parse(await response.json());
		const secret = enrollmentSecret(enrollment.ticket, ownerId, 0, key)!;
		now += 600_000;
		expect((await request('/api/auth/totp/enable', 'POST', {
			password, ticket: enrollment.ticket, code: totpCode(secret, Math.floor(now / 30_000))
		}, session)).status).toBe(401);
		expect(await repos.security.findTotp(ownerId)).toBeNull();
	});
	it('fails closed with a missing or different factor key and never bypasses it on password rotation', async () => {
		const secret = await enable(cookie(await login()));
		const user = (await repos.users.findById(ownerId))!;
		expect(await repos.users.changePassword(ownerId, user.passwordHash, user.passwordHash)).toBe(true);
		now += 30_000;
		expect((await login()).status).toBe(401);
		for (const factorKey of [undefined, 'b2'.repeat(32)]) {
			handler = createHandler({ ...createTestDeps(repos), ...(factorKey ? { totpKey: factorKey } : {}) });
			expect((await login(totpCode(secret, Math.floor(now / 30_000)))).status).toBe(401);
		}
	});
	it('denies readers and guests factor setup and audit while permitting reader global logout', async () => {
		await repos.users.create({ id: randomUUID(), username: 'reader', email: 'reader@example.test', name: 'Reader',
			role: 'reader', passwordHash: await hashPassword(password) });
		const session = cookie(await login(undefined, 'reader'));
		for (const path of ['/api/auth/totp', '/api/admin/audit']) {
			expect((await request(path)).status).toBe(401);
			expect((await request(path, 'GET', undefined, session)).status).toBe(403);
		}
		for (const path of ['/api/auth/totp/enroll', '/api/auth/totp/enable', '/api/auth/totp/disable']) {
			expect((await request(path, 'POST', { password }, session)).status).toBe(403);
		}
		expect((await request('/api/auth/logout/all', 'POST', {}, session)).status).toBe(200);
	});
	it('records critical events without exposing passwords, factor secrets or post bodies', async () => {
		const session = cookie(await login());
		await createPost(repos, { slug: 'audit-one', title: 'Sensitive body', contentMarkdown: 'Never put this content in the log.' });
		await createPost(repos, { slug: 'audit-two', title: 'Second', contentMarkdown: 'Another private body.' });
		const ids = [(await repos.posts.findBySlug('audit-one'))!.id, (await repos.posts.findBySlug('audit-two'))!.id];
		expect((await request('/api/admin/posts/delete', 'POST', { ids, confirmation: 'no' }, session)).status).toBe(400);
		expect((await request('/api/admin/posts/delete', 'POST', { ids, confirmation: 'DELETE' }, session)).status).toBe(200);
		expect(await repos.posts.findById(ids[0]!)).toBeNull();
		const history = await request('/api/admin/audit', 'GET', undefined, session);
		expect(history.headers.get('cache-control')).toBe('no-store');
		const text = await history.text();
		expect(text).toContain('posts.deleted');
		expect(text).toContain('user.created');
		for (const forbidden of [password, 'passwordHash', 'Never put this', key]) { expect(text).not.toContain(forbidden); }
		expect((await repos.security.listEvents(0)).find((event) => event.action === 'posts.deleted')).toMatchObject({
			actorId: ownerId, targetId: null, count: 2
		});
	});
	it('bounds deletion and history input and exposes later audit pages', async () => {
		const session = cookie(await login());
		for (const offset of ['-1', '1.5', '1e3', '100001']) {
			expect((await request(`/api/admin/audit?offset=${offset}`, 'GET', undefined, session)).status).toBe(400);
		}
		for (let index = 0; index < 55; index += 1) {
			await repos.security.record({ action: 'user.changed', actorId: ownerId, targetId: ownerId });
		}
		const first = historyDto.parse(await (await request('/api/admin/audit', 'GET', undefined, session)).json());
		expect(first).toMatchObject({ hasMore: true });
		expect(first.items).toHaveLength(50);
		const second = historyDto.parse(await (await request('/api/admin/audit?offset=50', 'GET', undefined, session)).json());
		expect(second).toMatchObject({ hasMore: false });
		expect(second.items).toHaveLength(6);
		expect((await request('/api/admin/posts/delete', 'POST', {
			ids: Array.from({ length: 101 }, () => randomUUID()), confirmation: 'DELETE'
		}, session)).status).toBe(400);
	});
});
