/**
 * @file editor-state.ts
 * @brief Comparable saved and live editor values, excluding transient upload controls.
 */
import type { EditorValues } from './server/editor-values.js';

const fields = {
	title: 'title',
	slug: 'slug',
	description: 'description',
	status: 'status',
	audience: 'audience',
	tags: 'tags',
	publishedAt: 'published_at',
	publishAt: 'publish_at',
	coverImage: 'cover_image',
	content: 'content'
};

/** @brief Normalizes persisted field representations. @param key Field. @param value Text. @return Comparable text. */
function normalized(key: string, value: string): string {
	if (key === 'tags')
		return [
			...new Set(
				value
					.split(',')
					.map((tag) => tag.trim())
					.filter(Boolean)
			)
		]
			.sort()
			.join(',');
	if (key === 'coverImage') return value.trim();
	if (key === 'audience') return value || 'public';
	if (key !== 'publishedAt' && key !== 'publishAt') return value.replace(/\r\n/g, '\n');
	const date = new Date(value);
	return value.trim() && !Number.isNaN(date.getTime()) ? date.toISOString() : value.trim();
}

/** @brief Compares values without treating equivalent tag/date formatting as edits. @param values Saved values or form data. @return Stable snapshot. */
export function editorSnapshot(values: EditorValues | FormData): string {
	return JSON.stringify(
		Object.entries(fields).map(([key, name]) => {
			const value = values instanceof FormData ? values.get(name) : Reflect.get(values, key);
			return [key, normalized(key, typeof value === 'string' ? value : '')];
		})
	);
}

/** @brief Reads named editor controls even while a submitted fieldset is disabled. @param form Editor form. @return Live snapshot. */
export function liveEditorSnapshot(form: HTMLFormElement): string {
	const values = new FormData();
	for (const name of Object.values(fields)) {
		const control = form.elements.namedItem(name);
		if (control && 'value' in control && typeof control.value === 'string')
			values.set(name, control.value);
	}
	return editorSnapshot(values);
}
