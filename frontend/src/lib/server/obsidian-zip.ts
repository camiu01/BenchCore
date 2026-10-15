/**
 * @file obsidian-zip.ts
 * @brief In-memory ZIP reading with bounded decompression and no filesystem extraction.
 */
import { Unzip, UnzipInflate, type UnzipFile } from 'fflate';

export interface VaultSources {
	files: { path: string; source: string }[];
	skipped: string[];
}

interface ZipState {
	result: VaultSources;
	names: Set<string>;
	total: number;
	entries: number;
}

/**
 * @brief Validates archive paths and selects only supported notes.
 * @param file Archive entry.
 * @param state Shared archive bounds and output.
 * @return Whether to decompress the entry.
 */
function acceptEntry(file: UnzipFile, state: ZipState): boolean {
	if (++state.entries > 10_000) {
		throw new Error('ZIP exceeds 10000 entries');
	}
	const path = file.name;
	if (
		path.includes('\\') ||
		path.startsWith('/') ||
		path.includes(':') ||
		path.split('/').some((part) => part === '..' || part === '.')
	) {
		throw new Error('unsafe ZIP entry path');
	}
	if (path.endsWith('/')) {
		return false;
	}
	if (!/\.md$/i.test(path) || path.split('/').some((part) => part.startsWith('.'))) {
		state.result.skipped.push(path);
		return false;
	}
	if (state.names.has(path) || state.names.size >= 500) {
		throw new Error('duplicate entry or more than 500 notes');
	}
	state.names.add(path);
	if ((file.originalSize ?? 0) > 200_000) {
		throw new Error('note exceeds 200 KB');
	}
	return true;
}

/**
 * @brief Streams an accepted note while bounding actual expanded bytes.
 * @param file Selected ZIP entry.
 * @param state Shared archive bounds and output.
 * @return Nothing.
 */
function readEntry(file: UnzipFile, state: ZipState): void {
	const chunks: Uint8Array[] = [];
	let size = 0;
	file.ondata = (error, chunk, final) => {
		if (error) {
			throw error;
		}
		size += chunk.length;
		state.total += chunk.length;
		if (size > 200_000 || state.total > 2_000_000) {
			file.terminate();
			throw new Error('ZIP exceeds expanded Markdown limits');
		}
		chunks.push(chunk);
		if (final) {
			state.result.files.push({ path: file.name, source: decodeSource(chunks, size) });
		}
	};
	file.start();
}

/**
 * @brief Joins bounded UTF-8 chunks without filesystem extraction.
 * @param chunks Decompressed source chunks.
 * @param size Actual source byte count.
 * @return Strictly decoded text.
 */
function decodeSource(chunks: Uint8Array[], size: number): string {
	const source = new Uint8Array(size);
	let offset = 0;
	for (const part of chunks) {
		source.set(part, offset);
		offset += part.length;
	}
	return new TextDecoder('utf-8', { fatal: true }).decode(source);
}

/**
 * @brief Bounds multipart bytes even when Content-Length is absent or incorrect.
 * @param request Incoming administrator upload.
 * @return Decoded bounded multipart form.
 */
export async function readVaultForm(request: Request): Promise<FormData> {
	const reader = request.body?.getReader();
	if (!reader) {
		throw new Error('missing upload');
	}
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			size += value.length;
			if (size > 2_100_000) {
				await reader.cancel();
				throw new Error('upload exceeds 2 MB');
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	return new Response(bytes, {
		headers: { 'content-type': request.headers.get('content-type') ?? '' }
	}).formData();
}

/**
 * @brief Decodes only visible Markdown entries and caps actual inflated bytes.
 * @param bytes ZIP archive, at most 2 MB compressed.
 * @return Validated text sources and skipped attachment paths.
 */
export function readVaultZip(bytes: Uint8Array): VaultSources {
	if (bytes.length > 2_000_000) {
		throw new Error('ZIP exceeds 2 MB');
	}
	const result: VaultSources = { files: [], skipped: [] };
	const state: ZipState = { result, names: new Set(), total: 0, entries: 0 };
	const unzip = new Unzip((file) => {
		if (acceptEntry(file, state)) {
			readEntry(file, state);
		}
	});
	unzip.register(UnzipInflate);
	for (let offset = 0; offset < bytes.length; offset += 4096) {
		unzip.push(bytes.subarray(offset, offset + 4096), offset + 4096 >= bytes.length);
	}
	if (result.files.length === 0 || state.names.size !== result.files.length) {
		throw new Error('ZIP contains no notes or is incomplete');
	}
	return result;
}
