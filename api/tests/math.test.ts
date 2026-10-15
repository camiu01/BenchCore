/**
 * @file math.test.ts
 * @brief Inline/display LaTeX rendering, literal code and untrusted-command regressions.
 */
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/markdown/render.js';
import { createPost, getPublishedPost } from '../src/posts/post-service.js';
import { createTestRepos } from './helpers.js';

describe('Markdown math', () => {
	it('renders inline electrical units and formulas as native MathML', async () => {
		const result = await renderMarkdown(String.raw`Supply $5\,\text{V}$ and $500\,\text{mA}$.`);
		expect(result.html.match(/<math /g)).toHaveLength(2);
		expect(result.html).toContain('<mtext>V</mtext>');
		expect(result.html).not.toContain('<script');
		expect(result.html).not.toContain('katex-error');
	});

	it('renders display equations inside paragraphs and on separate lines', async () => {
		const formula = String.raw`P = (12\,\text{V} - 5\,\text{V}) \cdot 0.5\,\text{A} = \mathbf{3.5\,\text{W}}`;
		for (const source of [`Before $$${formula}$$ After`, `$$\n${formula}\n$$\n\nAfter`]) {
			const result = await renderMarkdown(source);
			expect(result.html).toContain('display="block"');
			expect(result.html).toContain('<mtext>W</mtext>');
			expect(result.html).toContain('After');
		}
	});

	it('keeps code fences, inline code, escaped dollars and currency literal', async () => {
		const result = await renderMarkdown('`$x$`\n\n```tex\n$$x^2$$\n```\n\n\\$x\\$ costs $5 and $10.');
		expect(result.html).not.toContain('<math');
		expect(result.html).toContain('<code>$x$</code>');
		expect(result.html).toContain('$$x^2$$');
		expect(result.html).toContain('costs $5 and $10');
	});

	it('does not interpret dollars in raw HTML attributes as math', async () => {
		const result = await renderMarkdown('<img src="https://example.test/$x$" alt="$x$">');
		expect(result.html).not.toContain('<math');
		expect(result.html).toContain('alt="$x$"');
	});

	it('does not trust authored MathML or allow executable TeX commands', async () => {
		const source = String.raw`<math><mtext onclick="alert(1)">raw</mtext></math><script>alert(1)</script>

$\href{javascript:alert(1)}{click}$ $\htmlClass{unsafe}{x}$ $\includegraphics{https://evil.test/pixel}$`;
		const result = await renderMarkdown(source);
		expect(result.html).not.toContain('<script');
		expect(result.html).not.toContain('onclick=');
		expect(result.html).not.toContain('href="javascript:');
		expect(result.html).not.toContain('src="https://evil.test');
		expect(result.html).not.toContain('class="unsafe"');
	});

	it('falls back safely for malformed or oversized formulas', async () => {
		for (const source of [String.raw`$\frac{1$`, `$${'x'.repeat(4097)}$`, '$<script>alert(1)</script>\\badcommand$']) {
			const result = await renderMarkdown(source);
			expect(result.html).not.toContain('<script');
			expect(result.html).not.toContain('katex-error');
		}
	});

	it('renders formulas for already stored posts without reimporting or updating rows', async () => {
		const repos = createTestRepos();
		await createPost(repos, { title: 'Math', slug: 'math', status: 'published', contentMarkdown: '$V=IR$' });
		const row = await repos.posts.findBySlug('math');
		if (!row) { throw new Error('missing fixture'); }
		await repos.posts.update(row.id, { contentHtml: '<p>$V=IR$</p>' });
		expect((await getPublishedPost(repos, 'math'))?.contentHtml).toContain('<math');
		expect((await repos.posts.findBySlug('math'))?.contentHtml).toBe('<p>$V=IR$</p>');
	});
});
