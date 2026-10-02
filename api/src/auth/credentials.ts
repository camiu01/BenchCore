/**
 * @file credentials.ts
 * @brief Backward-compatible email or username credentials, never stored as plaintext.
 */
import { z } from 'zod';

export const usernameField = z.string().trim().regex(/^[a-z][a-z0-9_-]{2,31}$/i).transform((value) => value.toLowerCase());
export const loginSchema = z.object({
	email: z.union([z.email().max(254), usernameField]).optional(),
	username: usernameField.optional(),
	password: z.string().min(1).max(200)
}).refine((value) => (value.email === undefined) !== (value.username === undefined), {
	message: 'provide either email or username'
});

/**
 * @brief Decodes CLI JSON including PowerShell's UTF-8 byte order mark.
 * @param text Private JSON input, never logged.
 * @return Untrusted parsed value for service validation.
 */
export function parseCredentialJson(text: string): unknown {
	return JSON.parse(text.trim());
}
