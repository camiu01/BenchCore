/**
 * @file editor-values.ts
 * @brief Server-side editor form, date conversion and API payload validation.
 */
import { z } from 'zod';

export interface EditorValues {
	title: string;
	slug: string;
	description: string;
	status: string;
	audience?: string;
	tags: string;
	publishedAt: string;
	publishAt: string;
	coverImage: string;
	content: string;
}

const payloadSchema = z.object({
	title: z.string().min(1),
	slug: z.string().min(1),
	description: z.string(),
	status: z.enum(['draft', 'published', 'archived']),
	audience: z.enum(['public', 'readers']),
	tags: z.array(z.string()),
	contentMarkdown: z.string(),
	publishedAt: z.iso.datetime().nullable(),
	publishAt: z.iso.datetime().nullable(),
	coverImage: z.string().nullable()
});

/**
 * @brief Creates blank editor values.
 * @return The new-post defaults.
 */
export function blankValues(): EditorValues {
	return {
		title: '',
		slug: '',
		description: '',
		status: 'draft',
		audience: 'public',
		tags: '',
		publishedAt: '',
		publishAt: '',
		coverImage: '',
		content: ''
	};
}

/**
 * @brief Reads only textual fields from a submitted editor form.
 * @param form The submitted form data.
 * @return Values suitable for redisplay and payload validation.
 */
export function valuesFromForm(form: FormData): EditorValues {
	const values = blankValues();
	for (const key of Object.keys(values) as (keyof EditorValues)[]) {
		const field =
			key === 'publishedAt'
				? 'published_at'
				: key === 'publishAt'
					? 'publish_at'
					: key === 'coverImage'
						? 'cover_image'
						: key;
		const value = form.get(field);
		if (typeof value === 'string') {
			values[key] = value;
		}
	}
	return values;
}

/**
 * @brief Converts an optional explicit-offset ISO date to normalized UTC.
 * @param value The editor's date text, blank to clear.
 * @return A validated UTC ISO timestamp or null.
 */
export function editorDate(value: string): string | null {
	const trimmed = value.trim();
	if (trimmed === '') {
		return null;
	}
	const parsed = z.iso.datetime({ offset: true }).parse(trimmed);
	return new Date(parsed).toISOString();
}

/**
 * @brief Builds and validates a create/update payload, including explicit field clearing.
 * @param values The editor values.
 * @return The validated API payload.
 */
export function payloadFromValues(values: EditorValues): z.infer<typeof payloadSchema> {
	return payloadSchema.parse({
		title: values.title,
		slug: values.slug,
		description: values.description,
		status: values.status,
		audience: values.audience ?? 'public',
		tags: values.tags
			.split(',')
			.map((tag) => tag.trim())
			.filter(Boolean),
		contentMarkdown: values.content,
		publishedAt: editorDate(values.publishedAt),
		publishAt: editorDate(values.publishAt),
		coverImage: values.coverImage.trim() || null
	});
}

/**
 * @brief Appends the uploaded image on the server, preserving unsaved editor content.
 * @param values The submitted values.
 * @param url The validated same-origin media URL.
 * @return Values with an image Markdown reference.
 */
export function withUploadedImage(values: EditorValues, url: string): EditorValues {
	return { ...values, content: `${values.content}\n\n![](${url})\n` };
}
