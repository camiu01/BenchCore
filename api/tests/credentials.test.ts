/**
 * @file credentials.test.ts
 * @brief Username/email compatibility and unique username persistence.
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loginSchema, parseCredentialJson, usernameField } from '../src/auth/credentials.js';
import { createMemoryUsers } from '../src/db/memory.js';

describe('login identifiers', () => {
	it('decodes PowerShell UTF-8 BOM credential input without changing fields', () => {
		expect(parseCredentialJson('\uFEFF {"username":"exampleadmin"}\r\n')).toEqual({ username: 'exampleadmin' });
	});

	it('accepts usernames case-insensitively and preserves legacy email credentials', () => {
		expect(usernameField.parse('ExampleAdmin')).toBe('exampleadmin');
		expect(loginSchema.parse({ username: 'ExampleAdmin', password: 'test-only-password' }).username).toBe('exampleadmin');
		expect(loginSchema.safeParse({ email: 'admin@example.test', password: 'test-only-password' }).success).toBe(true);
		expect(loginSchema.safeParse({ email: 'ExampleAdmin', password: 'test-only-password' }).success).toBe(true);
	});

	it('rejects malformed identifiers and ambiguous credentials', () => {
		for (const value of ['bad name', '<script>', 'ab', 'x'.repeat(33)]) {
			expect(usernameField.safeParse(value).success).toBe(false);
		}
		expect(loginSchema.safeParse({ password: 'test-only-password' }).success).toBe(false);
		expect(loginSchema.safeParse({
			email: 'admin@example.test', username: 'exampleadmin', password: 'test-only-password'
		}).success).toBe(false);
	});

	it('keeps optional legacy usernames compatible and enforces normalized uniqueness', async () => {
		const users = createMemoryUsers();
		const fields = { email: 'admin@example.test', name: 'Example Admin', role: 'admin', passwordHash: 'unused' };
		const user = await users.create({ id: randomUUID(), username: 'ExampleAdmin', ...fields });
		expect((await users.findByUsername('EXAMPLEADMIN'))?.id).toBe(user.id);
		await expect(users.create({
			id: randomUUID(), ...fields, email: 'other@example.test', username: 'exampleadmin'
		})).rejects.toThrow('user already exists');
		const legacy = await users.create({ id: randomUUID(), ...fields, email: 'legacy@example.test' });
		expect(legacy.username).toBeNull();
	});
});
