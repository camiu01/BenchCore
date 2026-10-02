/**
 * @file accounts.test.ts
 * @brief Reader registration, role isolation, revocation and last-admin regression coverage.
 */
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password.js';
import { createHandler, startServer } from '../src/server.js';
import { createTestDeps, createTestRepos } from './helpers.js';

const password = 'test-only-long-password';
let server: Server;
let base: string;
let repos: ReturnType<typeof createTestRepos>;
let adminId: string;

beforeEach(async () => {
	repos = createTestRepos();
	adminId = randomUUID();
	await repos.users.create({ id: adminId, username: 'operator', email: 'operator@example.test',
		name: 'Operator', role: 'admin', passwordHash: await hashPassword(password) });
	server = startServer(0, createHandler(createTestDeps(repos)), '127.0.0.1');
	await new Promise<void>((resolve) => server.once('listening', resolve));
	base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });

/** @brief Sends API fixtures. @param path Path. @param method Method. @param body Optional JSON. @param cookie Cookie. @return Response. */
function request(path: string, method = 'GET', body?: unknown, cookie?: string) {
	return fetch(base + path, { method, headers: { origin: 'http://localhost:5173', 'content-type': 'application/json',
		...(cookie ? { cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
/** @brief Authenticates a fixture owner. @param username Username. @param secret Password. @return Cookie. */
async function login(username = 'operator', secret = password): Promise<string> {
	const response = await request('/api/auth/login', 'POST', { username, password: secret });
	expect(response.status).toBe(200);
	return response.headers.getSetCookie()[0]!.split(';')[0]!;
}
/** @brief Registers a reader fixture. @return Its DTO. */
async function reader() {
	const response = await request('/api/auth/register', 'POST', {
		username: 'reader', email: 'reader@example.test', name: 'Reader', password
	});
	expect(response.status).toBe(201);
	return (await response.json() as { user: { id: string; role: string } }).user;
}

describe('beta accounts', () => {
	it('creates only readers and never stores or returns plaintext passwords', async () => {
		const user = await reader();
		expect(user.role).toBe('reader');
		const stored = await repos.users.findById(user.id);
		expect(stored).not.toHaveProperty('password');
		expect(JSON.stringify(user)).not.toContain('password');
		expect(await verifyPassword(password, stored!.passwordHash)).toBe(true);
		const injected = await request('/api/auth/register', 'POST', {
			username: 'attacker', email: 'attacker@example.test', name: 'Attack', password, role: 'admin'
		});
		expect(injected.status).toBe(400);
	});
	it('rejects weak passwords and duplicate case-folded usernames/emails', async () => {
		await reader();
		for (const fields of [
			{ username: 'READER', email: 'other@example.test', password },
			{ username: 'other', email: 'READER@EXAMPLE.TEST', password },
			{ username: 'weak', email: 'weak@example.test', password: 'short' }
		]) {
			const response = await request('/api/auth/register', 'POST', { ...fields, name: 'Test' });
			expect(response.status).toBe(fields.password === 'short' ? 400 : 409);
		}
	});
	it('blocks anonymous/readers from every administrative account mutation and list', async () => {
		await reader();
		const cookie = await login('reader');
		for (const [method, path] of [['GET', '/api/admin/users'], ['POST', '/api/admin/users'], ['PATCH', `/api/admin/users/${adminId}`]]) {
			expect((await request(path!, method!, method === 'GET' ? undefined : {}, cookie)).status).toBe(403);
			expect((await request(path!, method!, method === 'GET' ? undefined : {})).status).toBe(401);
		}
	});
	it('keeps the last administrator active and redacts account listings', async () => {
		const cookie = await login();
		for (const patch of [{ isActive: false }, { role: 'reader' }]) {
			expect((await request(`/api/admin/users/${adminId}`, 'PATCH', patch, cookie)).status).toBe(409);
		}
		const listing = await request('/api/admin/users', 'GET', undefined, cookie);
		const text = await listing.text();
		expect(text).not.toContain('passwordHash');
		expect(text).not.toContain('sessionVersion');
		expect(text).not.toContain(password);
	});
	it('disables/reactivates accounts and never revives revoked cookies', async () => {
		const user = await reader();
		const readerCookie = await login('reader');
		const cookie = await login();
		expect((await request(`/api/admin/users/${user.id}`, 'PATCH', { isActive: false }, cookie)).status).toBe(200);
		expect((await request('/api/auth/me', 'GET', undefined, readerCookie)).status).toBe(401);
		expect((await request('/api/auth/login', 'POST', { username: 'reader', password })).status).toBe(401);
		expect((await request(`/api/admin/users/${user.id}`, 'PATCH', { isActive: true }, cookie)).status).toBe(200);
		expect((await request('/api/auth/me', 'GET', undefined, readerCookie)).status).toBe(401);
		expect(await login('reader')).toBeTruthy();
	});
	it('requires the current password and revokes all sessions after rotation', async () => {
		await reader();
		const first = await login('reader');
		const second = await login('reader');
		const path = '/api/auth/password';
		expect((await request(path, 'POST', { currentPassword: 'wrong', newPassword: 'new-long-password' }, first)).status).toBe(400);
		expect((await request(path, 'POST', { currentPassword: password, newPassword: 'short' }, first)).status).toBe(400);
		expect((await request(path, 'POST', { currentPassword: password, newPassword: 'new-long-password' }, first)).status).toBe(200);
		for (const cookie of [first, second]) { expect((await request('/api/auth/me', 'GET', undefined, cookie)).status).toBe(401); }
		expect((await request('/api/auth/login', 'POST', { username: 'reader', password })).status).toBe(401);
		expect(await login('reader', 'new-long-password')).toBeTruthy();
	});
	it('revokes privilege-bearing sessions when an admin is demoted', async () => {
		const user = await reader();
		const operatorCookie = await login();
		expect((await request(`/api/admin/users/${user.id}`, 'PATCH', { role: 'admin' }, operatorCookie)).status).toBe(200);
		const promotedCookie = await login('reader');
		expect((await request('/api/admin/users', 'GET', undefined, promotedCookie)).status).toBe(200);
		expect((await request(`/api/admin/users/${user.id}`, 'PATCH', { role: 'reader' }, operatorCookie)).status).toBe(200);
		expect((await request('/api/admin/users', 'GET', undefined, promotedCookie)).status).toBe(401);
	});
	it('uses compare-and-swap to stop concurrent stale password changes', async () => {
		const user = (await repos.users.findById(adminId))!;
		const results = await Promise.all([
			repos.users.changePassword(user.id, user.passwordHash, await hashPassword('first-long-password')),
			repos.users.changePassword(user.id, user.passwordHash, await hashPassword('second-long-password'))
		]);
		expect(results.filter(Boolean)).toHaveLength(1);
	});
});
