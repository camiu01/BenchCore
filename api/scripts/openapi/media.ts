/**
 * @file media.ts
 * @brief Storage-independent media contracts, direct R2 uploads and confirmed deletion.
 */
import { z } from 'zod';
import { mediaRecord, MAX_MEDIA_BYTES } from '../../src/media/storage.js';
import { input, json, operation, path, query, type Paths } from './helpers.js';
import { postLink, uuid } from './schemas.js';

const mime = mediaRecord.shape.mime;
export const mediaSchemas = {
	MediaRecord: input(mediaRecord),
	StoredMedia: input(mediaRecord.extend({ url: z.string() })),
	MediaUsage: input(
		z.object({
			uses: z.array(postLink.extend({ id: uuid })),
			version: z.string().regex(/^[a-f0-9]{64}$/)
		})
	),
	MediaInspection: {
		oneOf: [
			{ $ref: '#/components/schemas/MediaRecord' },
			{ $ref: '#/components/schemas/MediaUsage' }
		]
	},
	Upload: input(
		z
			.object({
				filename: z.string().min(1).max(200),
				mime,
				contentBase64: z
					.string()
					.min(1)
					.max(7500000)
					.regex(/^[A-Za-z0-9+/]*={0,2}$/)
			})
			.strict()
	),
	PrepareUpload: input(
		z
			.object({
				filename: z.string().min(1).max(200),
				mime,
				sizeBytes: z.number().int().positive().max(MAX_MEDIA_BYTES)
			})
			.strict()
	),
	CompleteUpload: input(z.object({ ticket: z.string().min(1).max(4096) }).strict()),
	PreparedUpload: input(z.object({ uploadUrl: z.url(), ticket: z.string() })),
	MediaDeletion: input(z.object({ version: z.string().regex(/^[a-f0-9]{64}$/) }))
};
const tag = 'Media';
const key = path(
	'key',
	input(mediaRecord.shape.key),
	'Generated managed image key, never a filesystem path or client filename.'
);
export const mediaPaths: Paths = {
	'/api/media': {
		post: operation({
			id: 'uploadMedia',
			summary: 'Upload a base64 image',
			tag,
			access: 'admin',
			mutates: true,
			body: 'Upload',
			result: 'StoredMedia',
			status: 201,
			description:
				'PNG/JPEG/WebP/GIF, nonempty decoded length at most 5 MiB; base64 length must be divisible by four. Body cap 8 MiB. Uses StorageProvider, not multipart. Prefer direct uploads for R2/Vercel.'
		})
	},
	'/api/media/upload': {
		post: operation({
			id: 'prepareDirectUpload',
			summary: 'Prepare an owner-bound direct R2 upload',
			tag,
			access: 'admin',
			mutates: true,
			body: 'PrepareUpload',
			result: 'PreparedUpload',
			errors: [404, 503],
			description:
				'Available only with direct-upload support. Body cap 16 KiB. PUT raw bytes to uploadUrl with exact declared length/type, no cookies and no redirects, then complete. Never log the signed URL or ticket.'
		})
	},
	'/api/media/complete': {
		post: operation({
			id: 'completeDirectUpload',
			summary: 'Verify and publish a staged R2 upload',
			tag,
			access: 'admin',
			mutates: true,
			body: 'CompleteUpload',
			result: 'StoredMedia',
			status: 201,
			errors: [404],
			description:
				'Body cap 16 KiB. Checks ticket owner/expiry, object type, length and ETag before immutable publication. Unsupported storage returns 404.'
		})
	},
	'/api/media/{key}': {
		get: operation({
			id: 'readMedia',
			summary: 'Read authorized image bytes or a signed redirect',
			tag,
			access: 'viewer',
			parameters: [
				key,
				{
					name: 'If-None-Match',
					in: 'header',
					required: false,
					description: 'Conditional public local/database read; audience is checked before 304.',
					schema: { type: 'string' }
				}
			],
			errors: [404],
			responses: {
				'200': {
					description:
						'Authorized bytes. Public local/database data: private, no-cache, must-revalidate and ETag; reader-only data: private, no-store. Vary: Cookie; CDN caching disabled.',
					content: Object.fromEntries(
						['image/png', 'image/jpeg', 'image/webp', 'image/gif'].map((type) => [
							type,
							{ schema: { type: 'string', format: 'binary' } }
						])
					),
					headers: {
						ETag: {
							description: 'Content digest on public local/database reads.',
							schema: { type: 'string' }
						}
					}
				},
				'304': { description: 'Authorized public bytes unchanged; no body.' },
				'307': {
					description: 'R2 short-lived signed read URL; private, no-store, no response body.',
					headers: {
						Location: {
							description: 'Signed object URL; never log it.',
							schema: { type: 'string', format: 'uri' }
						}
					}
				}
			},
			description:
				'Exclusively reader-audience saved uses require a valid reader/admin session. Missing, invalid and unauthorized keys share 404. Unreferenced/public-use images remain public by key. Issued URLs and downloaded bytes cannot be revoked retroactively.'
		}),
		delete: operation({
			id: 'deleteUnusedMedia',
			summary: 'Delete an unused image',
			tag,
			access: 'admin',
			mutates: true,
			parameters: [key],
			status: 204,
			errors: [404, 409],
			description:
				'409 image_in_use protects saved references. Inspect and confirm the admin media endpoint to remove references deliberately.'
		})
	},
	'/api/admin/media/{key}': {
		get: operation({
			id: 'inspectMedia',
			summary: 'Inspect saved uses or image metadata',
			tag,
			access: 'admin',
			parameters: [
				key,
				query(
					'details',
					{ type: 'string', enum: ['1'] },
					'When 1, returns MediaRecord; absent returns MediaUsage.'
				)
			],
			result: 'MediaInspection',
			errors: [400, 404],
			description:
				'Default returns affected post identifiers and a confirmation fingerprint, not image existence. details=1 returns metadata only or 404; never bytes, signed URLs or private object keys.'
		}),
		delete: operation({
			id: 'deleteManagedMedia',
			summary: 'Delete a confirmed image and saved references',
			tag,
			access: 'admin',
			mutates: true,
			parameters: [key],
			body: 'MediaDeletion',
			status: 204,
			errors: [404, 409, 502],
			responses: {
				'409': json('Error', 'usage_changed: inspect uses again before retrying.'),
				'502': json(
					'Error',
					'storage_failed: saved references were removed but storage deletion failed; an unreferenced object may remain.'
				)
			},
			description:
				'Send the latest inspection version after explicit user confirmation. Permanently removes saved Markdown/cover references, including other posts. Storage and reference updates are not one cross-system transaction; avoid concurrent edits.'
		})
	}
};
