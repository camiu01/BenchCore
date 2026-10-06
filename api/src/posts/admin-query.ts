/**
 * @file admin-query.ts
 * @brief Administrator ledger input validation.
 */
import { z } from 'zod';

export const adminPageSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(25),
	offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
	search: z.string().trim().max(200).optional(),
	status: z.enum(['draft', 'published', 'archived']).optional()
});
