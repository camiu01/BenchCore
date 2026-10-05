/**
 * @file direct-upload.ts
 * @brief Browser-direct private R2 upload flow with validated DTOs and no credential forwarding.
 */
import { z } from 'zod';

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
 * @return Validated same-origin media URL.
 */
export async function directImageUpload(
	file: File,
	fetcher: typeof fetch = fetch
): Promise<string> {
	if (
		!file.size ||
		file.size > 5 * 1024 * 1024 ||
		file.name.length > 200 ||
		!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)
	) {
		throw new Error('Select a png/jpg/webp/gif image up to 5 MiB.');
	}
	const prepared = await fetcher('/api/media/upload', {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ filename: file.name, mime: file.type, sizeBytes: file.size }),
		signal: AbortSignal.timeout(15_000)
	});
	if (!prepared.ok) {
		throw new Error('Upload authorization failed. Check your session and R2 configuration.');
	}
	const { uploadUrl, ticket } = preparedSchema.parse(await prepared.json());
	const uploaded = await fetcher(uploadUrl, {
		method: 'PUT',
		body: file,
		headers: { 'content-type': file.type },
		credentials: 'omit',
		redirect: 'error',
		signal: AbortSignal.timeout(90_000)
	});
	if (!uploaded.ok) {
		throw new Error('R2 upload failed. Check the bucket CORS policy.');
	}
	const completed = await fetcher('/api/media/complete', {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ ticket }),
		signal: AbortSignal.timeout(15_000)
	});
	if (!completed.ok) {
		throw new Error('Upload verification failed. Retry the upload.');
	}
	return completedSchema.parse(await completed.json()).url;
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
