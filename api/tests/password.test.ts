/**
 * @file password.test.ts
 * @brief Unit tests for scrypt password hashing.
 */
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password.js';

describe('password hashing', () => {
	it('verifies the correct password and rejects others', async () => {
		const hash = await hashPassword('correct-horse');
		expect(await verifyPassword('correct-horse', hash)).toBe(true);
		expect(await verifyPassword('wrong-horse', hash)).toBe(false);
	});

	it('salts every hash uniquely', async () => {
		const first = await hashPassword('same');
		const second = await hashPassword('same');
		expect(first).not.toBe(second);
	});

	it('rejects malformed envelopes', async () => {
		expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
		expect(await verifyPassword('x', 'scrypt$a$b$c$d$e')).toBe(false);
	});
});
