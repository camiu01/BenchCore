/**
 * @file password.ts
 * @brief scrypt password hashing and verification (no native bindings).
 */
import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';

/** scrypt cost parameters (interactive-login safe). */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

/** Derived key and salt sizes in bytes. */
const KEY_BYTES = 32;
const SALT_BYTES = 16;

/**
 * @brief Derives a key with scrypt.
 * @param password The plaintext password.
 * @param salt The salt bytes.
 * @return The derived key.
 */
function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		nodeScrypt(password, salt, KEY_BYTES, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (error, key) => {
			if (error !== null && error !== undefined) {
				reject(error);
				return;
			}
			resolve(key as Buffer);
		});
	});
}

/**
 * @brief Hashes a password into a self-describing envelope.
 * @param password The plaintext password.
 * @return The `scrypt$N$r$p$salthex$keyhex` envelope.
 */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(SALT_BYTES);
	const key = await deriveKey(password, salt);
	return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${key.toString('hex')}`;
}

/**
 * @brief Verifies a password against a stored envelope in constant time.
 * @param password The presented plaintext password.
 * @param stored The stored envelope.
 * @return True when the password matches.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const parts = stored.split('$');
	if (parts.length !== 6 || parts[0] !== 'scrypt') {
		return false;
	}
	const options = { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]) };
	if (!Number.isInteger(options.N) || !Number.isInteger(options.r) || !Number.isInteger(options.p)) {
		return false;
	}
	try {
		const salt = Buffer.from(parts[4] ?? '', 'hex');
		const expected = Buffer.from(parts[5] ?? '', 'hex');
		if (salt.length !== SALT_BYTES || expected.length !== KEY_BYTES) {
			return false;
		}
		const actual = await new Promise<Buffer>((resolve, reject) => {
			nodeScrypt(password, salt, KEY_BYTES, options, (error, key) => {
				if (error !== null && error !== undefined) {
					reject(error);
					return;
				}
				resolve(key as Buffer);
			});
		});
		return actual.length === expected.length && timingSafeEqual(actual, expected);
	} catch {
		return false;
	}
}
