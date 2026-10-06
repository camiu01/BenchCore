/**
 * @file r2.test.ts
 * @brief Offline R2 ticket, immutable publication, metadata and signature regression tests.
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createR2Storage, type R2Client } from '../src/media/r2.js';
import { r2Settings, signUploadTicket, verifyUploadTicket } from '../src/media/r2-settings.js';
import { MAX_MEDIA_BYTES } from '../src/media/storage.js';

const env = { R2_ACCOUNT_ID: 'a'.repeat(32), R2_BUCKET: 'test-media',
	R2_ACCESS_KEY_ID: 'test-access-key-only', R2_SECRET_ACCESS_KEY: 'test-secret-only-'.repeat(4),
	R2_UPLOAD_SECRET: 'test-upload-signing-only-'.repeat(3) };
const key = `${'b'.repeat(32)}.png`;
const record = { key, filename: 'image.png', mime: 'image/png' as const, sizeBytes: 10 };
const owner = randomUUID();

describe('private R2 uploads', () => {
	it('returns metadata without image bytes or private object keys', async () => {
		const send = vi.fn(async (command: unknown) => {
			if (!(command instanceof GetObjectCommand) || command.input.Key !== `media/${key}.json`) {
				throw new Error('Image bytes must not be fetched for metadata');
			}
			return { ContentLength: 200, Body: { transformToString: async () =>
				JSON.stringify({ ...record, objectKey: `${'c'.repeat(32)}.png` }) } };
		});
		const provider = createR2Storage(env, { send } as unknown as R2Client);
		expect(await provider.describe?.(key)).toEqual(record);
		expect(await provider.describe?.('../private')).toBeNull();
		expect(send).toHaveBeenCalledOnce();
	});
	it('keeps the sidecar when object deletion fails so removal can be retried', async () => {
		const send = vi.fn(async (command: unknown) => {
			if (command instanceof GetObjectCommand) {
				return { ContentLength: 200, Body: { transformToString: async () => JSON.stringify({ ...record, objectKey: key }) } };
			}
			throw new Error('Object deletion unavailable');
		});
		const provider = createR2Storage(env, { send } as unknown as R2Client);
		await expect(provider.remove(key)).rejects.toThrow('Object deletion unavailable');
		const deletes = send.mock.calls.filter(([command]) => command instanceof DeleteObjectCommand);
		expect(deletes).toHaveLength(1);
		expect((deletes[0]![0] as DeleteObjectCommand).input.Key).toBe(`objects/${key}`);
	});
	it('deletes the object before its sidecar and can retry a failed sidecar deletion', async () => {
		let attempts = 0;
		const send = vi.fn(async (command: unknown) => {
			if (command instanceof GetObjectCommand) {
				return { ContentLength: 200, Body: { transformToString: async () => JSON.stringify({ ...record, objectKey: key }) } };
			}
			if (command instanceof DeleteObjectCommand && command.input.Key === `media/${key}.json` && attempts++ === 0) {
				throw new Error('Sidecar deletion unavailable');
			}
			return {};
		});
		const provider = createR2Storage(env, { send } as unknown as R2Client);
		await expect(provider.remove(key)).rejects.toThrow('Sidecar deletion unavailable');
		expect(await provider.remove(key)).toBe(true);
		const keys = send.mock.calls.filter(([command]) => command instanceof DeleteObjectCommand)
			.map(([command]) => (command as DeleteObjectCommand).input.Key);
		expect(keys).toEqual([`objects/${key}`, `media/${key}.json`, `objects/${key}`, `media/${key}.json`]);
	});
	it('fails closed on missing credentials, malformed bucket and account endpoints', () => {
		expect(() => r2Settings({})).toThrow();
		expect(() => r2Settings({ ...env, R2_ACCOUNT_ID: 'https://evil.test' })).toThrow();
		expect(() => r2Settings({ ...env, R2_BUCKET: '../private' })).toThrow();
		expect(r2Settings(env).accountId).toBe(env.R2_ACCOUNT_ID);
	});
	it('binds completion to metadata, authenticated owner, signature and expiry', () => {
		const ticket = signUploadTicket({ record, owner, expires: 2000 }, env.R2_UPLOAD_SECRET);
		expect(verifyUploadTicket(ticket, owner, env.R2_UPLOAD_SECRET, 1000)).toEqual(record);
		expect(() => verifyUploadTicket(ticket, randomUUID(), env.R2_UPLOAD_SECRET, 1000)).toThrow();
		expect(() => verifyUploadTicket(ticket, owner, env.R2_UPLOAD_SECRET, 2000)).toThrow();
		expect(() => verifyUploadTicket(`${ticket}0`, owner, env.R2_UPLOAD_SECRET, 1000)).toThrow();
		expect(() => verifyUploadTicket(ticket, owner, 'other'.repeat(10), 1000)).toThrow();
		expect(() => verifyUploadTicket('x'.repeat(5000), owner, env.R2_UPLOAD_SECRET)).toThrow();
	});
	it('presigns exact byte length and MIME for staging only, without a network request', async () => {
		const provider = createR2Storage(env);
		const upload = await provider.direct!.prepare({ filename: 'image.png', mime: 'image/png', sizeBytes: MAX_MEDIA_BYTES }, owner);
		const url = new URL(upload.uploadUrl);
		expect(url.hostname).toBe(`${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
		expect(url.pathname).toMatch(/^\/test-media\/staging\/[a-f0-9]{32}\.png$/);
		expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-length');
		expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-type');
		expect(url.searchParams.get('X-Amz-Expires')).toBe('120');
		expect(upload.uploadUrl).not.toContain(env.R2_SECRET_ACCESS_KEY);
		await expect(provider.direct!.prepare({ filename: 'x', mime: 'text/html', sizeBytes: 1 }, owner)).rejects.toThrow();
		await expect(provider.direct!.prepare({ filename: 'x', mime: 'image/png', sizeBytes: MAX_MEDIA_BYTES + 1 }, owner)).rejects.toThrow();
	});
	it('rejects mismatched uploaded headers without publishing any final object', async () => {
		const send = vi.fn(async (command: unknown) => {
			if (command instanceof GetObjectCommand) { throw new Error('missing sidecar'); }
			return { ContentLength: 999, ContentType: 'image/png', ETag: 'version' };
		});
		const provider = createR2Storage(env, { send } as unknown as R2Client);
		const ticket = signUploadTicket({ record, owner, expires: Date.now() + 60_000 }, env.R2_UPLOAD_SECRET);
		await expect(provider.direct!.complete(ticket, owner)).rejects.toThrow();
		expect(send.mock.calls.some(([command]) => command instanceof PutObjectCommand || command instanceof CopyObjectCommand)).toBe(false);
	});
	it('copies the exact staged version before publishing sidecar metadata', async () => {
		const send = vi.fn(async (command: unknown) => {
			if (command instanceof GetObjectCommand) { throw new Error('missing sidecar'); }
			if (command instanceof HeadObjectCommand) { return { ContentLength: 10, ContentType: 'image/png', ETag: 'version-one' }; }
			return {};
		});
		const provider = createR2Storage(env, { send } as unknown as R2Client);
		const ticket = signUploadTicket({ record, owner, expires: Date.now() + 60_000 }, env.R2_UPLOAD_SECRET);
		expect(await provider.direct!.complete(ticket, owner)).toEqual(record);
		const copy = send.mock.calls.find(([command]) => command instanceof CopyObjectCommand)![0] as CopyObjectCommand;
		expect(copy.input.CopySourceIfMatch).toBe('version-one');
		expect(copy.input.CopySource).toBe(`test-media/staging/${key}`);
		expect(copy.input.Key).toMatch(/^objects\/[a-f0-9]{32}\.png$/);
		const sidecar = send.mock.calls.find(([command]) => command instanceof PutObjectCommand)![0] as PutObjectCommand;
		expect(sidecar.input.IfNoneMatch).toBe('*');
		expect(JSON.parse(sidecar.input.Body as string)).toEqual({ ...record, objectKey: copy.input.Key!.slice('objects/'.length) });
	});
	it('never serves uncompleted, oversized or mismatched sidecars', async () => {
		const send = vi.fn().mockResolvedValue({ ContentLength: 999999, Body: { transformToString: async () => JSON.stringify(record) } });
		const provider = createR2Storage(env, { send } as unknown as R2Client);
		expect(await provider.readUrl!('../private')).toBeNull();
		expect(send).not.toHaveBeenCalled();
		expect(await provider.readUrl!(key)).toBeNull();
		send.mockResolvedValue({ ContentLength: 200, Body: { transformToString: async () => JSON.stringify({ ...record, key: `${'c'.repeat(32)}.png` }) } });
		expect(await provider.readUrl!(key)).toBeNull();
	});
	it('never overwrites the published object when two completions race', async () => {
		const winner = `${'c'.repeat(32)}.png`;
		let reads = 0;
		const send = vi.fn(async (command: unknown) => {
			if (command instanceof GetObjectCommand) {
				if (reads++ === 0) { throw new Error('not published yet'); }
				return { ContentLength: 300, Body: { transformToString: async () => JSON.stringify({ ...record, objectKey: winner }) } };
			}
			if (command instanceof HeadObjectCommand) { return { ContentLength: 10, ContentType: 'image/png', ETag: 'original-version' }; }
			if (command instanceof PutObjectCommand) { throw new Error('PreconditionFailed'); }
			return {};
		});
		const provider = createR2Storage(env, { send } as unknown as R2Client);
		const ticket = signUploadTicket({ record, owner, expires: Date.now() + 60_000 }, env.R2_UPLOAD_SECRET);
		expect(await provider.direct!.complete(ticket, owner)).toEqual(record);
		const copy = send.mock.calls.find(([command]) => command instanceof CopyObjectCommand)![0] as CopyObjectCommand;
		expect(copy.input.Key).not.toBe(`objects/${winner}`);
		const deletes = send.mock.calls.filter(([command]) => command instanceof DeleteObjectCommand).map(([command]) => (command as DeleteObjectCommand).input.Key);
		expect(deletes).toContain(copy.input.Key);
		expect(deletes).not.toContain(`objects/${winner}`);
	});
	it('redirects completed records to short-lived signed reads and supports retrying completion', async () => {
		const send = vi.fn().mockResolvedValue({ ContentLength: 200, Body: { transformToString: async () => JSON.stringify({ ...record, objectKey: key }) } });
		const sdk = new S3Client({ region: 'auto', endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
			credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } });
		const signer: typeof getSignedUrl = (_client, command, options) =>
			getSignedUrl(sdk, command as unknown as GetObjectCommand, options);
		const provider = createR2Storage(env, { send } as unknown as R2Client, signer);
		const url = new URL((await provider.readUrl!(key))!);
		expect(url.searchParams.get('X-Amz-Expires')).toBe('60');
		const ticket = signUploadTicket({ record, owner, expires: Date.now() + 60_000 }, env.R2_UPLOAD_SECRET);
		expect(await provider.direct!.complete(ticket, owner)).toEqual(record);
		expect(send.mock.calls.every(([command]) => command instanceof GetObjectCommand)).toBe(true);
	});
});
