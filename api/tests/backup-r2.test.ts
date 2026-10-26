/**
 * @file backup-r2.test.ts
 * @brief Offline strict R2 inventory, pagination and immutable recovery regressions.
 */
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';
import { createR2Storage, type R2Client } from '../src/media/r2.js';

const env = {
	R2_ACCOUNT_ID: 'a'.repeat(32),
	R2_BUCKET: 'test-media',
	R2_ACCESS_KEY_ID: 'fixture-access-key-only',
	R2_SECRET_ACCESS_KEY: 'fixture-secret-'.repeat(4),
	R2_UPLOAD_SECRET: 'fixture-signing-'.repeat(4)
};
const key = `${'b'.repeat(32)}.png`;
const record = { key, filename: 'fixture.png', mime: 'image/png', sizeBytes: 3 };

describe('R2 recovery protocol (offline)', () => {
	it('preserves public keys and conditionally creates both bytes and metadata', async () => {
		const send = vi.fn().mockResolvedValue({});
		const media = createR2Storage(env, { send } as unknown as R2Client);
		await media.restore!(record, Buffer.from('png'));
		const puts = send.mock.calls.map(([command]) => (command as PutObjectCommand).input);
		expect(puts.map((input) => input.Key)).toEqual([`objects/${key}`, `media/${key}.json`]);
		expect(puts.every((input) => input.IfNoneMatch === '*')).toBe(true);
		expect(JSON.parse(String(puts[1]!.Body))).toEqual({ ...record, objectKey: key });
	});

	it('never replaces an existing object or publishes its metadata after a collision', async () => {
		const send = vi.fn().mockRejectedValue(new Error('PreconditionFailed'));
		const media = createR2Storage(env, { send } as unknown as R2Client);
		await expect(media.restore!(record, Buffer.from('png'))).rejects.toThrow('PreconditionFailed');
		expect(send).toHaveBeenCalledOnce();
	});

	it('does not silently omit inaccessible published metadata during backup', async () => {
		const send = vi.fn(async (command: unknown) => {
			if (command instanceof ListObjectsV2Command)
				return { Contents: [{ Key: `media/${key}.json` }] };
			throw new Error('Permission denied');
		});
		const media = createR2Storage(env, { send } as unknown as R2Client);
		expect(await media.list()).toEqual([]);
		await expect(media.list({ strict: true })).rejects.toThrow('Unreadable R2 metadata');
	});

	it('reads every metadata page and rejects a truncated listing without a next token', async () => {
		const send = vi.fn(async (command: unknown) => {
			if (command instanceof GetObjectCommand)
				return {
					ContentLength: 200,
					Body: {
						transformToString: async () =>
							JSON.stringify({ ...record, objectKey: `${'c'.repeat(32)}.png` })
					}
				};
			if (command instanceof ListObjectsV2Command && command.input.ContinuationToken)
				return { Contents: [] };
			return {
				Contents: [{ Key: `media/${key}.json` }],
				IsTruncated: true,
				NextContinuationToken: 'page-two'
			};
		});
		const media = createR2Storage(env, { send } as unknown as R2Client);
		expect(await media.list({ strict: true })).toEqual([record]);
		expect(
			send.mock.calls.filter(([command]) => command instanceof ListObjectsV2Command)
		).toHaveLength(2);
		send.mockResolvedValue({ IsTruncated: true } as never);
		await expect(media.list({ strict: true })).rejects.toThrow('Incomplete R2 inventory');
	});
});
