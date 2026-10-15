/**
 * @file obsidian-zip.test.ts
 * @brief ZIP traversal, compression limits and UTF-8 note extraction regressions.
 */
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readVaultForm, readVaultZip } from '../src/lib/server/obsidian-zip.js';

describe('Obsidian ZIP reader', () => {
	it('bounds multipart uploads without trusting Content-Length', async () => {
		const form = new FormData();
		form.set('visibility', 'private');
		form.set('vault', new File([new Uint8Array(zipSync({ 'Note.md': strToU8('Body') }))], 'vault.zip'));
		const request = new Request('http://localhost/admin/import', { method: 'POST', body: form });
		expect((await readVaultForm(request)).get('visibility')).toBe('private');
		await expect(
			readVaultForm(
				new Request('http://localhost/admin/import', {
					method: 'POST',
					body: 'x'.repeat(2_100_001)
				})
			)
		).rejects.toThrow();
	});
	it('reads nested notes and skips settings and attachments', () => {
		const archive = zipSync({
			'Vault/Notes/Caffè.md': strToU8('Caffè [[Other]]'),
			'Vault/.obsidian/config.json': strToU8('{}'),
			'Vault/image.png': new Uint8Array([1, 2])
		});
		const result = readVaultZip(archive);
		expect(result.files).toEqual([{ path: 'Vault/Notes/Caffè.md', source: 'Caffè [[Other]]' }]);
		expect(result.skipped).toHaveLength(2);
	});

	it.each(['../outside.md', '/absolute.md', 'C:/drive.md', 'a\\b.md'])(
		'rejects unsafe path %s',
		(path) => {
			expect(() => readVaultZip(zipSync({ [path]: strToU8('body') }))).toThrow();
		}
	);

	it('rejects compressed oversized notes and excess actual decompressed total', () => {
		expect(() => readVaultZip(zipSync({ 'Big.md': strToU8('x'.repeat(200_001)) }))).toThrow();
		const notes = Object.fromEntries(
			Array.from({ length: 11 }, (_, index) => [`${index}.md`, strToU8('x'.repeat(190_000))])
		);
		expect(() => readVaultZip(zipSync(notes))).toThrow();
	});

	it('rejects malformed archives, empty vaults and invalid UTF-8', () => {
		expect(() => readVaultZip(new Uint8Array([1, 2, 3]))).toThrow();
		expect(() => readVaultZip(zipSync({ 'image.png': new Uint8Array([1]) }))).toThrow();
		expect(() => readVaultZip(zipSync({ 'Bad.md': new Uint8Array([255, 255]) }))).toThrow();
	});
});
