/**
 * @file direct-upload.ts
 * @brief Browser-direct private R2 upload flow with validated DTOs and no credential forwarding.
 */
import { z } from 'zod';
import { uploadWithProgress } from './upload-progress.js';
import { DEFAULT_LOCALE } from './i18n/locale.js';
import { translate, type MessageKey, type MessageParams } from './i18n/translate.js';

const preparedSchema = z.object({
	uploadUrl: z
		.string()
		.url()
		.refine((value) => {
			const url = new URL(value);
			return (
				url.protocol === 'https:' &&
				/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(url.hostname) &&
				!url.username &&
				!url.password &&
				!url.port
			);
		}),
	ticket: z.string().min(1).max(4096)
});
const completedSchema = z.object({
	url: z.string().regex(/^\/api\/media\/[A-Za-z0-9]{32}\.(png|jpg|jpeg|webp|gif)$/)
});

/**
 * @brief Uploads bytes directly to a bounded presigned R2 URL, then completes metadata.
 * @param file Selected image.
 * @param fetcher Browser fetch or an offline test double.
 * @param progress Overall upload workflow percentage.
 * @param tr Message translator for user-facing errors.
 * @return Validated same-origin media URL.
 */
export async function directImageUpload(
	file: File,
	fetcher: typeof fetch = fetch,
	progress: (percent: number) => void = () => undefined,
	tr: (key: MessageKey, params?: MessageParams) => string = (key, params) =>
		translate(DEFAULT_LOCALE, key, params)
): Promise<string> {
	if (
		!file.size ||
		file.size > 5 * 1024 * 1024 ||
		file.name.length > 200 ||
		!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)
	) {
		throw new Error(tr('editor.error.invalidFile'));
	}
	progress(0);
	const prepared = await fetcher('/api/media/upload', {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ filename: file.name, mime: file.type, sizeBytes: file.size }),
		signal: AbortSignal.timeout(15_000)
	});
	if (!prepared.ok) {
		throw new Error(tr('editor.error.authorization'));
	}
	const { uploadUrl, ticket } = preparedSchema.parse(await prepared.json());
	await transferImage(file, uploadUrl, fetcher, progress, tr);
	progress(95);
	const url = await completeUpload(ticket, fetcher, tr);
	progress(100);
	return url;
}

/** @brief Verifies staged metadata before exposing a managed image URL. @param ticket Owner-bound ticket. @param fetcher API transport. @param tr Message translator. @return Validated URL. */
async function completeUpload(
	ticket: string,
	fetcher: typeof fetch,
	tr: (key: MessageKey, params?: MessageParams) => string
): Promise<string> {
	const completed = await fetcher('/api/media/complete', {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ ticket }),
		signal: AbortSignal.timeout(15_000)
	});
	if (!completed.ok) {
		throw new Error(tr('editor.error.verification'));
	}
	return completedSchema.parse(await completed.json()).url;
}

/** @brief Selects measurable browser transfer, retaining an offline fetch seam. @param file Image. @param url Validated signed URL. @param fetcher Fetch seam. @param progress Overall workflow percentage. @param tr Message translator. @return Completion. */
async function transferImage(
	file: File,
	url: string,
	fetcher: typeof fetch,
	progress: (percent: number) => void,
	tr: (key: MessageKey, params?: MessageParams) => string
): Promise<void> {
	if (typeof XMLHttpRequest !== 'undefined' && fetcher === fetch) {
		await uploadWithProgress(
			file,
			url,
			(percent) => progress(Math.round(percent * 0.9)),
			undefined,
			tr
		);
		return;
	}
	const response = await fetcher(url, {
		method: 'PUT',
		body: file,
		headers: { 'content-type': file.type },
		credentials: 'omit',
		redirect: 'error',
		signal: AbortSignal.timeout(90_000)
	});
	if (!response.ok) throw new Error(tr('editor.error.r2Failed'));
	progress(90);
}

/**
 * @brief Inserts a validated media reference at the live cursor without discarding unsaved text.
 * @param textarea Live editor textarea.
 * @param url Validated same-origin media URL.
 * @return Nothing.
 */
export function insertImageReference(textarea: HTMLTextAreaElement, url: string): void {
	const reference = `![](${url})`;
	textarea.setRangeText(reference, textarea.selectionStart, textarea.selectionEnd, 'end');
	textarea.dispatchEvent(new Event('input', { bubbles: true }));
}
