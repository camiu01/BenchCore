/**
 * @file r2.ts
 * @brief Private R2 media with owner-bound direct uploads and validated metadata.
 */
import { randomUUID } from 'node:crypto';
import { CopyObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command,
	PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mediaRecord, sanitizeKey, validateUpload, type StorageProvider, type StoredMedia } from './storage.js';
import { r2Settings, signUploadTicket, verifyUploadTicket, type R2Settings } from './r2-settings.js';

const privateRecord = mediaRecord.extend({ objectKey: mediaRecord.shape.key });

/** @brief R2 dependency injection supports offline protocol tests. */
export interface R2Client {
	send: S3Client['send'];
}

/**
 * @brief Creates an R2 provider without any bucket mutation or public credential exposure.
 * @param env Runtime settings.
 * @param client Optional mocked S3 client.
 * @param signer Optional offline signer.
 * @return Private media provider.
 */
export function createR2Storage(env: NodeJS.ProcessEnv, client?: R2Client, signer = getSignedUrl): StorageProvider {
	const settings = r2Settings(env);
	const sdk = client ?? new S3Client({ region: 'auto', forcePathStyle: true, maxAttempts: 2,
		endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
		credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
		requestHandler: { connectionTimeout: 3000, requestTimeout: 10_000 },
		requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
	return new R2Storage(settings, sdk, signer);
}

/** @brief R2 persists opaque keys and sidecars; only completed objects are readable. */
class R2Storage implements StorageProvider {
	/**
	 * @brief Retains validated configuration and a bounded S3 client.
	 * @param settings Private configuration. @param client Bounded client.
	 * @param signer URL signer. @return Initialized provider.
	 */
	constructor(private settings: R2Settings, private client: R2Client, private signer: typeof getSignedUrl) {}
	/** @brief Browser-direct operations use the same provider seam. */
	direct = {
		prepare: (input: { filename: string; mime: string; sizeBytes: number }, owner: string) => this.prepare(input, owner),
		complete: (ticket: string, owner: string) => this.complete(ticket, owner)
	};

	/**
	 * @brief Allocates an opaque object key and signs exact MIME and byte length.
	 * @param input Validated upload fields.
	 * @param owner Administrator UUID.
	 * @return Short-lived PUT URL and owner-bound completion ticket.
	 */
	private async prepare(input: { filename: string; mime: string; sizeBytes: number }, owner: string) {
		const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
		const record = mediaRecord.parse({ ...input, key: `${randomUUID().replace(/-/g, '')}.${extensions[input.mime] ?? 'invalid'}` });
		const command = new PutObjectCommand({ Bucket: this.settings.bucket, Key: `staging/${record.key}`,
			ContentType: record.mime, ContentLength: record.sizeBytes });
		const uploadUrl = await this.signer(this.client as S3Client, command, {
			expiresIn: 120, signableHeaders: new Set(['content-type', 'content-length'])
		});
		return { uploadUrl, ticket: signUploadTicket({ record, owner, expires: Date.now() + 120_000 }, this.settings.uploadSecret) };
	}

	/**
	 * @brief Validates the uploaded object's actual headers before publishing a sidecar.
	 * @param ticket Owner-bound ticket.
	 * @param owner Authenticated administrator.
	 * @return Completed record.
	 */
	private async complete(ticket: string, owner: string): Promise<StoredMedia> {
		const record = verifyUploadTicket(ticket, owner, this.settings.uploadSecret);
		const existing = await this.metadata(record.key);
		if (existing && JSON.stringify(mediaRecord.parse(existing)) === JSON.stringify(record)) { return record; }
		const head = await this.client.send(new HeadObjectCommand({ Bucket: this.settings.bucket, Key: `staging/${record.key}` }));
		if (head.ContentLength !== record.sizeBytes || head.ContentType !== record.mime) {
			throw new Error('Uploaded object does not match its ticket');
		}
		if (!head.ETag) { throw new Error('Uploaded object has no version identifier'); }
		const objectKey = `${randomUUID().replace(/-/g, '')}.${record.key.split('.').at(-1)}`;
		await this.client.send(new CopyObjectCommand({ Bucket: this.settings.bucket, Key: `objects/${objectKey}`,
			CopySource: `${this.settings.bucket}/staging/${record.key}`, CopySourceIfMatch: head.ETag,
			MetadataDirective: 'REPLACE', ContentType: record.mime }));
		try {
			await this.client.send(new PutObjectCommand({ Bucket: this.settings.bucket, Key: `media/${record.key}.json`,
				IfNoneMatch: '*', ContentType: 'application/json', Body: JSON.stringify({ ...record, objectKey }) }));
		} catch (error) {
			const published = await this.metadata(record.key);
			if (published && published.objectKey !== objectKey) {
				await this.client.send(new DeleteObjectCommand({ Bucket: this.settings.bucket, Key: `objects/${objectKey}` }));
			}
			if (!published || JSON.stringify(mediaRecord.parse(published)) !== JSON.stringify(record)) { throw error; }
		}
		await this.client.send(new DeleteObjectCommand({ Bucket: this.settings.bucket, Key: `staging/${record.key}` }));
		return record;
	}

	/**
	 * @brief Stores a small server-side upload with the same validation contract.
	 * @param data Bytes. @param filename Original filename. @param mime Declared type.
	 * @return Stored metadata.
	 */
	async save(data: Buffer, filename: string, mime: string): Promise<StoredMedia> {
		const extension = validateUpload(data, mime);
		const record = mediaRecord.parse({ key: `${randomUUID().replace(/-/g, '')}.${extension}`, filename, mime, sizeBytes: data.length });
		await this.client.send(new PutObjectCommand({ Bucket: this.settings.bucket, Key: `objects/${record.key}`, ContentType: mime, Body: data }));
		await this.client.send(new PutObjectCommand({ Bucket: this.settings.bucket, Key: `media/${record.key}.json`,
			IfNoneMatch: '*', ContentType: 'application/json', Body: JSON.stringify({ ...record, objectKey: record.key }) }));
		return record;
	}

	/**
	 * @brief Loads only bounded valid metadata belonging to the requested safe key.
	 * @param key Opaque storage key.
	 * @return Record or null.
	 */
	private async metadata(key: string): Promise<(StoredMedia & { objectKey: string }) | null> {
		if (!sanitizeKey(key)) { return null; }
		try {
			const file = await this.client.send(new GetObjectCommand({ Bucket: this.settings.bucket, Key: `media/${key}.json` }));
			if (!file.Body || !file.ContentLength || file.ContentLength > 16_384) { return null; }
			const record = privateRecord.parse(JSON.parse(await file.Body.transformToString()));
			return record.key === key ? record : null;
		} catch { return null; }
	}

	/**
	 * @brief Redirects public media to short-lived R2 GET URLs, avoiding function payload limits.
	 * @param key Opaque key.
	 * @return Signed read URL or null for uncompleted objects.
	 */
	async readUrl(key: string): Promise<string | null> {
		const record = await this.metadata(key);
		if (!record) { return null; }
		return this.signer(this.client as S3Client, new GetObjectCommand({ Bucket: this.settings.bucket,
			Key: `objects/${record.objectKey}`, ResponseContentType: record.mime }), { expiresIn: 60 });
	}

	/**
	 * @brief Loads bounded bytes for compatibility with nonserverless callers.
	 * @param key Opaque key.
	 * @return Image or null.
	 */
	async load(key: string): Promise<{ data: Buffer; mime: string } | null> {
		const record = await this.metadata(key);
		if (!record) { return null; }
		const file = await this.client.send(new GetObjectCommand({ Bucket: this.settings.bucket, Key: `objects/${record.objectKey}` }));
		if (!file.Body || file.ContentLength !== record.sizeBytes) { return null; }
		return { data: Buffer.from(await file.Body.transformToByteArray()), mime: record.mime };
	}

	/**
	 * @brief Removes bytes and sidecar only for an existing completed object.
	 * @param key Opaque key.
	 * @return Whether a completed record existed and deletion succeeded.
	 */
	async remove(key: string): Promise<boolean> {
		const record = await this.metadata(key);
		if (!record) { return false; }
		const result = await this.client.send(new DeleteObjectsCommand({ Bucket: this.settings.bucket,
			Delete: { Objects: [{ Key: `objects/${record.objectKey}` }, { Key: `media/${key}.json` }], Quiet: true } }));
		return !result.Errors?.length;
	}

	/**
	 * @brief Lists validated records across paginated metadata objects.
	 * @return Filename-ordered records.
	 */
	async list(): Promise<StoredMedia[]> {
		const records: StoredMedia[] = [];
		let token: string | undefined;
		do {
			const page = await this.client.send(new ListObjectsV2Command({ Bucket: this.settings.bucket, Prefix: 'media/', ContinuationToken: token }));
			for (const entry of page.Contents ?? []) {
				if (!entry.Key?.endsWith('.json')) { continue; }
				const record = await this.metadata(entry.Key.slice('media/'.length, -'.json'.length));
				if (record) { records.push(mediaRecord.parse(record)); }
			}
			token = page.IsTruncated ? page.NextContinuationToken : undefined;
		} while (token);
		return records.sort((a, b) => a.filename.localeCompare(b.filename));
	}
}
