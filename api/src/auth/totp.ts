/**
 * @file totp.ts
 * @brief RFC 6238 SHA-1 TOTP and authenticated, purpose-bound encryption of factor material.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const totpCodeSchema = z.string().regex(/^\d{6}$/);
export const factorPasswordSchema = z.object({ password: z.string().min(1).max(200) }).strict();
export const factorConfirmationSchema = factorPasswordSchema.extend({
	code: totpCodeSchema,
	ticket: z.string().min(1).max(2048)
});
const enrollmentSchema = z.object({
	secret: z.string().regex(/^[a-f0-9]{40}$/),
	version: z.number().int().nonnegative(),
	expiresAt: z.number().int()
}).strict();

/** @brief Validates an optional encryption key without displaying it. @param env Environment. @return Key or undefined. */
export function configuredTotpKey(env: NodeJS.ProcessEnv): string | undefined {
	const key = env['AUTH_TOTP_KEY'];
	if (key !== undefined && !/^[a-f0-9]{64}$/i.test(key)) { throw new Error('AUTH_TOTP_KEY must contain 64 hexadecimal characters'); }
	return key;
}

/** @brief Encodes authenticator-compatible base32. @param bytes Random secret bytes. @return Unpadded base32. */
export function base32Secret(bytes: Buffer): string {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
	let bits = 0;
	let value = 0;
	let encoded = '';
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) { bits -= 5; encoded += alphabet[(value >>> bits) & 31]; }
	}
	if (bits > 0) { encoded += alphabet[(value << (5 - bits)) & 31]; }
	return encoded;
}

/** @brief Generates a six-digit RFC 6238 code. @param secret Hex secret. @param step Thirty-second counter. @return Code. */
export function totpCode(secret: string, step: number): string {
	const counter = Buffer.alloc(8);
	counter.writeBigUInt64BE(BigInt(step));
	const digest = createHmac('sha1', Buffer.from(secret, 'hex')).update(counter).digest();
	const offset = digest[digest.length - 1]! & 15;
	return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/** @brief Matches a code with one step of clock skew. @param secret Hex secret. @param code Six digits. @param now Epoch milliseconds. @return Matching step or null. */
export function verifiedTotpStep(secret: string, code: string, now: number = Date.now()): number | null {
	if (!totpCodeSchema.safeParse(code).success) { return null; }
	const step = Math.floor(now / 30_000);
	for (const candidate of [step, step - 1, step + 1]) {
		if (candidate >= 0 && timingSafeEqual(Buffer.from(code), Buffer.from(totpCode(secret, candidate)))) { return candidate; }
	}
	return null;
}

/** @brief Encrypts material with owner- and purpose-bound authentication. @param value Plaintext. @param key Hex key. @param context Purpose and owner. @return Envelope. */
export function sealFactor(value: string, key: string, context: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
	cipher.setAAD(Buffer.from(context));
	const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
	return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

/** @brief Authenticates and decrypts factor material. @param value Envelope. @param key Hex key. @param context Purpose and owner. @return Plaintext or null. */
export function openFactor(value: string, key: string, context: string): string | null {
	try {
		if (!/^[A-Za-z0-9_-]{38,2048}$/.test(value)) { return null; }
		const bytes = Buffer.from(value, 'base64url');
		const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), bytes.subarray(0, 12));
		decipher.setAAD(Buffer.from(context));
		decipher.setAuthTag(bytes.subarray(12, 28));
		return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
	} catch { return null; }
}

/** @brief Creates a short-lived enrollment without persisting unconfirmed factors. @param id Owner. @param version Epoch. @param key Encryption key. @return Manual key and encrypted ticket. */
export function createEnrollment(id: string, version: number, key: string) {
	const secret = randomBytes(20);
	const ticket = sealFactor(JSON.stringify({ secret: secret.toString('hex'), version, expiresAt: Date.now() + 600_000 }),
		key, `enrollment:${id}`);
	return { secret: base32Secret(secret), ticket };
}

/** @brief Validates a bounded enrollment ticket for the current account epoch. @param ticket Encrypted ticket. @param id Owner. @param version Epoch. @param key Key. @return Hex secret or null. */
export function enrollmentSecret(ticket: string, id: string, version: number, key: string): string | null {
	try {
		const opened = openFactor(ticket, key, `enrollment:${id}`);
		const parsed = enrollmentSchema.safeParse(JSON.parse(opened ?? 'null'));
		return parsed.success && parsed.data.version === version && parsed.data.expiresAt > Date.now()
			? parsed.data.secret : null;
	} catch { return null; }
}
