/**
 * @file manifest.ts
 * @brief Versioned, bounded metadata for a private PostgreSQL and managed-image backup.
 */
import { z } from 'zod';
import { mediaRecord } from '../media/storage.js';

export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const backendSchema = z.enum(['local', 'database', 'r2']);
export const archiveMediaSchema = mediaRecord
	.extend({
		filename: z.string().max(200),
		sha256: digestSchema
	})
	.strict();
export const manifestSchema = z
	.object({
		format: z.literal('benchcore-backup-v1'),
		appVersion: z.string().min(1).max(64),
		createdAt: z.iso.datetime(),
		backend: backendSchema,
		database: z
			.object({
				sha256: digestSchema,
				sizeBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
			})
			.strict(),
		media: z.array(archiveMediaSchema).max(100_000)
	})
	.strict()
	.refine(
		(value) => new Set(value.media.map((item) => item.key)).size === value.media.length,
		'duplicate media keys'
	);

export type BackupManifest = z.infer<typeof manifestSchema>;
export type BackupBackend = z.infer<typeof backendSchema>;
export interface BackupDatabase {
	/** @brief Dumps the complete database into a private file. @param file Dump destination. @return Completion. */
	dump(file: string): Promise<void>;
	/** @brief Refuses a target with any non-system database objects. @return Completion. */
	assertEmpty(): Promise<void>;
	/** @brief Restores a trusted dump atomically, without clean/drop/overwrite flags. @param file Verified dump. @return Completion. */
	restore(file: string): Promise<void>;
}
