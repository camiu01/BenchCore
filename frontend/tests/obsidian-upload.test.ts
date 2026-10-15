/**
 * @file obsidian-upload.test.ts
 * @brief Multiple Markdown selection validation and unchanged ZIP compatibility.
 */
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readVaultUploads } from '../src/lib/server/obsidian-upload.js';

describe('Obsidian upload selections', () => {
	it('reads multiple Markdown files together while preserving links and UTF-8', async () => {
		const result = await readVaultUploads([
			new File(['[[Caffè|Coffee]]'], 'Index.md'),
			new File(['Una nota caffè'], 'Caffè.md')
		]);
		expect(result).toEqual({
			files: [
				{ path: 'Index.md', source: '[[Caffè|Coffee]]' },
				{ path: 'Caffè.md', source: 'Una nota caffè' }
			],
			skipped: []
		});
	});

	it('continues to accept one ZIP', async () => {
		const file = new File(
			[new Uint8Array(zipSync({ 'Notes/Note.md': strToU8('Body') }))],
			'Vault.zip'
		);
		expect((await readVaultUploads([file])).files).toEqual([
			{ path: 'Notes/Note.md', source: 'Body' }
		]);
	});

	it('rejects empty selections, non-files and mixed archives before importing', async () => {
		await expect(readVaultUploads([])).rejects.toThrow();
		await expect(readVaultUploads(['not a file'])).rejects.toThrow();
		await expect(readVaultUploads([new File([], '')])).rejects.toThrow();
		await expect(
			readVaultUploads([new File([], 'Vault.zip'), new File(['Body'], 'Note.md')])
		).rejects.toThrow();
	});

	it.each([
		'../Note.md',
		'Folder/Note.md',
		'Folder\\Note.md',
		'C:Note.md',
		'.hidden.md',
		'Note.txt'
	])('rejects unsafe or unsupported filename %s', async (name) => {
		await expect(readVaultUploads([new File(['Body'], name)])).rejects.toThrow();
	});

	it('rejects duplicate normalized filenames instead of silently merging notes', async () => {
		await expect(
			readVaultUploads([new File(['One'], 'NOTE.md'), new File(['Two'], 'Note.md')])
		).rejects.toThrow();
		await expect(
			readVaultUploads([new File(['One'], 'Caffè.md'), new File(['Two'], 'Caffe\u0300.md')])
		).rejects.toThrow();
	});

	it('enforces per-file, total and count limits', async () => {
		await expect(readVaultUploads([new File(['x'.repeat(200_001)], 'Big.md')])).rejects.toThrow();
		await expect(
			readVaultUploads(
				Array.from({ length: 11 }, (_, i) => new File(['x'.repeat(190_000)], `${i}.md`))
			)
		).rejects.toThrow();
		await expect(
			readVaultUploads(Array.from({ length: 501 }, (_, i) => new File(['Body'], `${i}.md`)))
		).rejects.toThrow();
	});

	it('rejects invalid UTF-8 instead of corrupting the note', async () => {
		await expect(readVaultUploads([new File([new Uint8Array([255])], 'Bad.md')])).rejects.toThrow();
	});
});
