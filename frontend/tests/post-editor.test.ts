/**
 * @file post-editor.test.ts
 * @brief Disabled scheduling preserves existing dates while allowing explicit manual publication.
 */
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PostEditor from '../src/lib/components/PostEditor.svelte';
import { blankValues } from '../src/lib/server/editor-values.js';

describe('temporarily disabled scheduling', () => {
	it('preserves scheduled drafts and exposes explicit schedule clearing', () => {
		const result = render(PostEditor, {
			props: {
				values: { ...blankValues(), publishAt: '2026-10-10T12:00:00Z' },
				isNew: false,
				previewHtml: null,
				uploadedUrl: null,
				errorMsg: null,
				schedulerEnabled: false
			}
		});
		expect(result.body).toContain('CLEAR');
		expect(result.body).toMatch(
			/type="hidden"[^>]*name="publish_at"[^>]*value="2026-10-10T12:00:00Z"/
		);
		expect(result.body).toMatch(/type="datetime-local"[^>]*readonly/);
	});
	it('does not offer a clear button for an empty disabled schedule', () => {
		const result = render(PostEditor, {
			props: {
				values: blankValues(),
				isNew: true,
				previewHtml: null,
				uploadedUrl: null,
				errorMsg: null,
				schedulerEnabled: false
			}
		});
		expect(result.body).not.toContain('CLEAR SCHEDULE');
	});
});
