/**
 * @file frontmatter.ts
 * @brief Splits +++ TOML frontmatter from the Markdown body with structured errors.
 */
import { parse as parseToml } from 'smol-toml';

/**
 * @brief Machine-readable frontmatter failure.
 */
export interface FrontmatterIssue {
	file: string;
	kind: 'missing-fences' | 'empty-toml' | 'toml-error';
	message: string;
}

/**
 * @brief Result of splitting one Markdown source file.
 */
export type SplitResult =
	| { ok: true; toml: string; body: string }
	| { ok: false; issue: FrontmatterIssue };

/** Fence marker opening and closing the TOML block. */
const FENCE = '+++';

/**
 * @brief Splits raw TOML frontmatter from the Markdown body.
 * @param source The full file content.
 * @param file The file name used in error reports.
 * @return The TOML block plus body, or a structured issue.
 */
export function splitFrontmatter(source: string, file: string): SplitResult {
	const lines = source.split('\n');
	if (lines[0]?.trim() !== FENCE) {
		return {
			ok: false,
			issue: { file, kind: 'missing-fences', message: 'expected +++ TOML fences on line 1' }
		};
	}
	const closer = lines.findIndex((line, index) => index > 0 && line.trim() === FENCE);
	if (closer === -1) {
		return {
			ok: false,
			issue: { file, kind: 'missing-fences', message: 'unclosed +++ TOML fences' }
		};
	}
	const toml = lines.slice(1, closer).join('\n');
	if (toml.trim() === '') {
		return { ok: false, issue: { file, kind: 'empty-toml', message: 'TOML block is empty' } };
	}
	return { ok: true, toml, body: lines.slice(closer + 1).join('\n') };
}

/**
 * @brief Parses a TOML block into an untyped value.
 * @param toml The TOML source.
 * @param file The file name used in error reports.
 * @return The parsed value or a structured issue.
 */
export function parseTomlBlock(
	toml: string,
	file: string
): { ok: true; data: unknown } | { ok: false; issue: FrontmatterIssue } {
	try {
		return { ok: true, data: parseToml(toml) };
	} catch (error) {
		const message = error instanceof Error ? error.message : 'invalid TOML';
		return { ok: false, issue: { file, kind: 'toml-error', message } };
	}
}
