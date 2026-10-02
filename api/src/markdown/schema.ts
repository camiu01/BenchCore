/**
 * @file schema.ts
 * @brief Zod schemas for TOML frontmatter plus shared post field fragments.
 */
import { z } from 'zod';

/**
 * @brief URL-safe post slug: lowercase alphanumerics joined by single dashes.
 */
export const slugField = z
	.string()
	.min(1)
	.max(100)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase alphanumeric with dashes');

/**
 * @brief Validated TOML frontmatter of one Markdown post file.
 */
export const frontmatterSchema = z.object({
	title: z.string().min(1).max(200),
	slug: slugField,
	description: z.string().max(500).default(''),
	status: z.enum(['draft', 'published', 'archived']).default('draft'),
	tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
	published_at: z.iso.datetime({ offset: true }).optional(),
	publish_at: z.iso.datetime({ offset: true }).optional(),
	cover_image: z.string().max(500).optional()
});

/**
 * @brief Validated frontmatter value.
 */
export type Frontmatter = z.output<typeof frontmatterSchema>;

/**
 * @brief Flattens Zod issues into readable path: message strings.
 * @param error The Zod error from safeParse.
 * @return The flattened issue list.
 */
export function flattenIssues(error: z.ZodError): string[] {
	return error.issues.map((issue) => {
		const path = issue.path.map(String).join('.') || '(root)';
		return `${path}: ${issue.message}`;
	});
}

/**
 * @brief Validates an untyped TOML value against the frontmatter schema.
 * @param data The parsed TOML value.
 * @return The valid frontmatter or flattened issues.
 */
export function validateFrontmatter(
	data: unknown
): { ok: true; value: Frontmatter } | { ok: false; issues: string[] } {
	const parsed = frontmatterSchema.safeParse(data);
	if (!parsed.success) {
		return { ok: false, issues: flattenIssues(parsed.error) };
	}
	return { ok: true, value: parsed.data };
}
