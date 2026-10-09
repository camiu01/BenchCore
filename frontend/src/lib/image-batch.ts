/**
 * @file image-batch.ts
 * @brief Bounded sequential image uploads and safe editor insertion.
 */
import { directImageUpload } from './direct-upload.js';
import { DEFAULT_LOCALE } from './i18n/locale.js';
import { translate, type MessageKey, type MessageParams } from './i18n/translate.js';

export interface ImageUploadItem {
	file: File;
	status: 'queued' | 'uploading' | 'uploaded' | 'failed';
	error: string | null;
	url: string | null;
	progress: number;
}

/**
 * @brief Creates a bounded upload queue.
 * @param files Selected or dropped files.
 * @return At most twenty queued files.
 */
export function imageUploadQueue(files: File[]): ImageUploadItem[] {
	return files.slice(0, 20).map((file) => ({
		file,
		status: 'queued',
		error: null,
		url: null,
		progress: 0
	}));
}

/**
 * @brief Uploads queued images in order, retaining successes on partial failure.
 * @param items Mutable queue.
 * @param onUploaded Successful upload callback.
 * @param onProgress Queue update callback.
 * @param upload Single-image upload implementation.
 * @param tr Message translator for user-facing errors.
 * @return Completion.
 */
export async function uploadImageBatch(
	items: ImageUploadItem[],
	onUploaded: (url: string, file: File) => void,
	onProgress: () => void,
	upload?: (file: File, progress: (percent: number) => void) => Promise<string>,
	tr: (key: MessageKey, params?: MessageParams) => string = (key, params) =>
		translate(DEFAULT_LOCALE, key, params)
): Promise<void> {
	const send =
		upload ??
		((file: File, progress: (percent: number) => void) =>
			directImageUpload(file, fetch, progress, tr));
	for (const item of items) {
		if (item.status === 'uploaded') continue;
		item.status = 'uploading';
		item.error = null;
		item.progress = 0;
		onProgress();
		try {
			const url = await send(item.file, (percent) => {
				item.progress = Math.max(
					item.progress,
					Math.min(100, Math.max(0, Number.isFinite(percent) ? Math.round(percent) : 0))
				);
				onProgress();
			});
			item.url = url;
			item.status = 'uploaded';
			item.progress = 100;
			onUploaded(url, item.file);
		} catch (cause) {
			item.status = 'failed';
			item.error = cause instanceof Error ? cause.message : tr('editor.error.uploadFailed');
		}
		onProgress();
	}
}

/** @brief Reorders a queued batch without mutating successes or running transfers. @param items Queue. @param index Selected position. @param direction Previous or next. @return Reordered queue. */
export function moveQueuedImage(
	items: ImageUploadItem[],
	index: number,
	direction: -1 | 1
): ImageUploadItem[] {
	const target = index + direction;
	if (
		index < 0 ||
		target < 0 ||
		target >= items.length ||
		items.some((item) => item.status === 'uploading' || item.status === 'uploaded')
	)
		return items;
	const reordered = [...items];
	const selected = reordered[index];
	if (!selected) return items;
	reordered.splice(index, 1);
	reordered.splice(target, 0, selected);
	return reordered;
}

/**
 * @brief Inserts one image without replacing existing text and fills an empty cover.
 * @param textarea Live Markdown editor.
 * @param cover Live cover field.
 * @param url Validated media URL.
 * @param cursor Insertion offset.
 * @param filename Original filename for an editable description.
 * @return Cursor immediately after the inserted reference.
 */
export function insertUploadedImage(
	textarea: HTMLTextAreaElement,
	cover: HTMLInputElement,
	url: string,
	cursor: number,
	filename = ''
): number {
	const position = Math.min(Math.max(cursor, 0), textarea.value.length);
	const prefix = position > 0 && textarea.value[position - 1] !== '\n' ? '\n\n' : '';
	const label = filename
		.replace(/\.[^.]+$/, '')
		.replace(/[\r\n]/g, ' ')
		.replace(/\\/g, '\\\\')
		.replace(/\[/g, '\\[')
		.replace(/\]/g, '\\]');
	const reference = `${prefix}![${label}](${url})\n\n`;
	textarea.setRangeText(reference, position, position, 'end');
	textarea.dispatchEvent(new Event('input', { bubbles: true }));
	if (cover.value.trim() === '') {
		cover.value = url;
		cover.dispatchEvent(new Event('input', { bubbles: true }));
	}
	return position + reference.length;
}
