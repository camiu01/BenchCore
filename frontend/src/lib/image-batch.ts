/**
 * @file image-batch.ts
 * @brief Bounded sequential image uploads and safe editor insertion.
 */
import { directImageUpload } from './direct-upload.js';

export interface ImageUploadItem {
	file: File;
	status: 'queued' | 'uploading' | 'uploaded' | 'failed';
	error: string | null;
	url: string | null;
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
		url: null
	}));
}

/**
 * @brief Uploads queued images in order, retaining successes on partial failure.
 * @param items Mutable queue.
 * @param onUploaded Successful upload callback.
 * @param onProgress Queue update callback.
 * @param upload Single-image upload implementation.
 * @return Completion.
 */
export async function uploadImageBatch(
	items: ImageUploadItem[],
	onUploaded: (url: string, file: File) => void,
	onProgress: () => void,
	upload: (file: File) => Promise<string> = directImageUpload
): Promise<void> {
	for (const item of items) {
		if (item.status === 'uploaded') continue;
		item.status = 'uploading';
		item.error = null;
		onProgress();
		try {
			const url = await upload(item.file);
			item.url = url;
			item.status = 'uploaded';
			onUploaded(url, item.file);
		} catch (cause) {
			item.status = 'failed';
			item.error = cause instanceof Error ? cause.message : 'Upload failed.';
		}
		onProgress();
	}
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
