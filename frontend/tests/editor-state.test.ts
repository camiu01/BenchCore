/**
 * @file editor-state.test.ts
 * @brief Unsaved-change comparisons ignore uploads, but preserve real content changes.
 */
import { describe, expect, it } from 'vitest';
import { editorSnapshot } from '../src/lib/editor-state.js';
import { blankValues } from '../src/lib/server/editor-values.js';

describe('editor saved state', () => {
	it('detects changes to every persisted field', () => {
		const saved = blankValues();
		for (const key of Object.keys(saved)) {
			expect(editorSnapshot({ ...saved, [key]: 'changed' })).not.toBe(editorSnapshot(saved));
		}
	});

	it('normalizes tag ordering, date offsets and default audience', () => {
		const saved = { ...blankValues(), tags: 'one, two', publishedAt: '2026-01-01T10:00:00Z' };
		expect(
			editorSnapshot({
				...saved,
				tags: 'two, one, one',
				audience: '',
				publishedAt: '2026-01-01T11:00:00+01:00'
			})
		).toBe(editorSnapshot(saved));
	});

	it('reads named form fields without including files or action buttons', () => {
		const values = blankValues();
		const data = new FormData();
		for (const [name, value] of Object.entries(values)) data.set(name, value);
		data.set('image', new Blob(['bytes']), 'test.png');
		data.set('action', 'preview');
		expect(editorSnapshot(data)).toBe(editorSnapshot(values));
		data.set('content', 'Unsaved text');
		expect(editorSnapshot(data)).not.toBe(editorSnapshot(values));
	});

	it('does not hide invalid dates or meaningful content whitespace', () => {
		const saved = blankValues();
		expect(editorSnapshot({ ...saved, publishAt: 'invalid' })).not.toBe(editorSnapshot(saved));
		expect(editorSnapshot({ ...saved, content: ' ' })).not.toBe(editorSnapshot(saved));
	});
});
