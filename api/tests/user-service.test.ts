/**
 * @file user-service.test.ts
 * @brief CLI provisioning validates input, hashes credentials and preserves existing users.
 */
import { describe, expect, it } from 'vitest';
import { createAdministrator } from '../src/auth/user-service.js';
import { createMemoryUsers } from '../src/db/memory.js';
import { verifyPassword } from '../src/auth/password.js';

describe('administrator provisioning', () => {
	it('creates a database user with a hashed password and fixed administrator role', async () => {
		const users = createMemoryUsers();
		expect(await createAdministrator(users, {
			username: 'ExampleAdmin', name: 'Example Admin', password: 'test-only-password'
		})).toBe('created');
		const user = await users.findByUsername('exampleadmin');
		expect(user?.role).toBe('admin');
		expect(user?.email).toBe('exampleadmin@local.invalid');
		expect(user?.passwordHash).not.toBe('test-only-password');
		expect(await verifyPassword('test-only-password', user?.passwordHash ?? '')).toBe(true);
	});

	it('does not replace an existing account password, role or name', async () => {
		const users = createMemoryUsers();
		await createAdministrator(users, { username: 'exampleadmin', name: 'Original', password: 'original-test-password' });
		expect(await createAdministrator(users, {
			username: 'EXAMPLEADMIN', name: 'Changed', password: 'replacement-test-password'
		})).toBe('exists');
		const user = await users.findByUsername('exampleadmin');
		expect(user?.name).toBe('Original');
		expect(await verifyPassword('original-test-password', user?.passwordHash ?? '')).toBe(true);
	});

	it('rejects invalid names and passwords before persistence', async () => {
		const users = createMemoryUsers();
		await expect(createAdministrator(users, { username: 'bad name', password: '' })).rejects.toThrow();
		expect(await users.findByUsername('bad name')).toBeNull();
	});
});
