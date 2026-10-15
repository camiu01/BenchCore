/**
 * @file math.ts
 * @brief Bounded LaTeX rendering to native MathML without scripts, remote fonts or trusted HTML.
 */
import { randomUUID } from 'node:crypto';
import katex from 'katex';
import { Marked, type TokenizerExtension, type Tokens } from 'marked';

/**
 * @brief Escapes a formula that cannot safely be rendered.
 * @param source Original formula including delimiters.
 * @return Inert readable fallback.
 */
function fallback(source: string): string {
	return source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * @brief Renders bounded formulas without enabling HTML or external-resource commands.
 * @param token Math token produced by our lexer.
 * @return Native browser MathML or an escaped source fallback.
 */
function renderFormula(token: Tokens.Generic): string {
	const text: unknown = token.text;
	if (typeof text !== 'string' || text.length > 4096) { return fallback(token.raw); }
	try {
		return katex.renderToString(text, {
			output: 'mathml', displayMode: token.displayMode === true,
			trust: false, throwOnError: true, strict: 'error', maxExpand: 100, maxSize: 20
		});
	} catch { return fallback(token.raw); }
}

/**
 * @brief Tokenizes math before Markdown interprets LaTeX underscores or backslashes.
 * @param block Whether this extension handles standalone display formulas.
 * @return Marked extension; code tokens remain opaque to the inline lexer.
 */
function mathTokenizer(block: boolean): TokenizerExtension {
	return {
		name: block ? 'blockMath' : 'inlineMath',
		level: block ? 'block' : 'inline',
		start: (source) => source.indexOf(block ? '$$' : '$'),
		/** @brief Matches one delimited formula. @param source Remaining Markdown. @return Math token if present. */
		tokenizer(source) {
			const pattern = block
				? /^ {0,3}\$\$([\s\S]+?)\$\$(?:[ \t]*\n)?/
				: /^(?:\$\$([\s\S]+?)\$\$|\$(?!\s)((?:\\[\s\S]|[^\\$\n])+?)(?<!\s)\$(?!\d))/;
			const match = pattern.exec(source);
			if (!match) { return undefined; }
			return {
				type: block ? 'blockMath' : 'inlineMath', raw: match[0],
				text: match[1] ?? match[2] ?? '', displayMode: block || source.startsWith('$$')
			};
		}
	};
}

/**
 * @brief Parses Markdown while isolating generated MathML from untrusted authored HTML.
 * @param source Markdown source.
 * @return Parsed HTML and resolver used only after normal HTML sanitization.
 */
export async function parseMathMarkdown(source: string): Promise<{
	html: string;
	restore: (sanitized: string) => string;
}> {
	const marker = `BENCHCOREMATH${randomUUID().replace(/-/g, '')}TOKEN`;
	const formulas: string[] = [];
	/** @brief Saves generated math behind an unguessable placeholder. @param token Math token. @return Plain marker. */
	const renderer = (token: Tokens.Generic): string => {
		const index = formulas.push(renderFormula(token)) - 1;
		return `${marker}${index}END`;
	};
	const parser = new Marked({ extensions: [
		{ ...mathTokenizer(true), renderer },
		{ ...mathTokenizer(false), renderer }
	] });
	const html = await parser.parse(source);
	return {
		html,
		restore: (sanitized) => sanitized.replace(new RegExp(`${marker}(\\d+)END`, 'g'),
			(_match, index: string) => formulas[Number(index)] ?? '')
	};
}
