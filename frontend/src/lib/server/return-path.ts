/**
 * @file return-path.ts
 * @brief Strict local post destinations for sign-in return navigation.
 */
import { z } from 'zod';
const postPath = z
	.string()
	.max(250)
	.regex(/^\/posts\/[a-z0-9]+(?:-[a-z0-9]+)*$/i);

/**
 * @brief Accepts only a local canonical post path, never an external redirect.
 * @param value Untrusted query or form value.
 * @return Valid post path or null.
 */
export function postReturnPath(value: unknown): string | null {
	const parsed = postPath.safeParse(value);
	return parsed.success ? parsed.data : null;
}
