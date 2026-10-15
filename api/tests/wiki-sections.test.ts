/**
 * @file wiki-sections.test.ts
 * @brief Obsidian-style section navigation, safe heading IDs and fragment-free backlinks.
 */
import { describe, expect, it } from 'vitest';
import { extractWikiLinks, renderMarkdown } from '../src/markdown/render.js';
import { importObsidianVault } from '../src/posts/obsidian-import.js';
import { getPublishedPost } from '../src/posts/post-service.js';
import { createTestRepos } from './helpers.js';

describe('wiki section links', () => {
	it('resolves note titles, sections and aliases to matching semantic anchors', async () => {
		const source = await renderMarkdown('See [[Glossario Rapido#Baud Rate]] or [[glossario-rapido#Baud Rate|UART speed]].');
		const target = await renderMarkdown('#### Baud Rate\nTransmission speed.');
		expect(source.html).toContain('href="/posts/glossario-rapido#baud-rate"');
		expect(source.html).toContain('>Glossario Rapido#Baud Rate</a>');
		expect(source.html).toContain('>UART speed</a>');
		expect(target.html).toContain('<h4 id="baud-rate">');
	});

	it('supports same-note sections and ignores fragments in backlink targets', async () => {
		const result = await renderMarkdown('[[#Baud Rate|Here]] [[glossary#First]] [[glossary#Second]]',
			{ knownSlugs: new Set(['glossary']) });
		expect(result.html).toContain('href="#baud-rate" class="wikilink">Here</a>');
		expect(result.html).not.toContain('broken');
		expect(result.links).toEqual(['glossary']);
		expect(extractWikiLinks('[[Glossario Rapido#Baud Rate]]')).toEqual(['glossario-rapido']);
	});

	it('normalizes accents, punctuation and formatted heading labels consistently', async () => {
		const result = await renderMarkdown('[[#Tè & Caffè (AC/DC)]]\n\n## **Tè** & Caffè (AC/DC)');
		expect(result.html).toContain('href="#te-caffe-ac-dc"');
		expect(result.html).toContain('<h2 id="te-caffe-ac-dc">');
	});

	it('keeps IDs unique, including heading titles resembling legacy anchors', async () => {
		const result = await renderMarkdown('## Setup\n## Setup\n## Setup-2\n## post-section\n## post-section-1');
		const ids = [...result.html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toContain('setup');
		expect(ids).toContain('setup-2');
		expect(ids).toContain('setup-2-2');
		expect(ids).toContain('post-section-1');
	});

	it('never admits authored IDs, handlers or unescaped attributes through fragments', async () => {
		const result = await renderMarkdown('<h2 id="unsafe" onclick="alert(1)">Baud Rate</h2>\n\n[[glossary#x" onmouseover="alert(1)|Safe]]');
		expect(result.html).not.toContain('id="unsafe"');
		expect(result.html).not.toContain('onclick=');
		expect(result.html).not.toContain(' onmouseover=');
		expect(result.html).toContain('<h2 id="baud-rate">');
	});

	it('preserves section references across vault import and published reads', async () => {
		const repos = createTestRepos();
		const result = await importObsidianVault({ visibility: 'public', files: [
			{ path: 'Theory/Serial.md', source: '[[Glossario Rapido#Baud Rate|speed]]' },
			{ path: 'Glossario Rapido.md', source: '#### Baud Rate\nBits per second.' }
		] }, repos);
		expect(result.errors).toEqual([]);
		expect(result.warnings).toEqual([]);
		const source = await getPublishedPost(repos, 'theory-serial');
		const target = await getPublishedPost(repos, 'glossario-rapido');
		expect(source?.contentHtml).toContain('href="/posts/glossario-rapido#baud-rate"');
		expect(target?.contentHtml).toContain('<h4 id="baud-rate">');
		expect(target?.backlinks.map((link) => link.slug)).toContain('theory-serial');
	});
});
