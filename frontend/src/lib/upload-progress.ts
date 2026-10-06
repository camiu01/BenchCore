/**
 * @file upload-progress.ts
 * @brief Credential-free signed uploads with bounded byte progress.
 */

/** @brief Sends bytes without cookies and rejects redirected final responses; XMLHttpRequest cannot prevent redirects in flight. @param file Image. @param url Validated R2 URL. @param progress Byte-transfer percentage. @param factory XMLHttpRequest test seam. @return Completion. */
export function uploadWithProgress(
	file: File,
	url: string,
	progress: (percent: number) => void,
	factory: () => XMLHttpRequest = () => new XMLHttpRequest()
): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = factory();
		request.open('PUT', url);
		request.withCredentials = false;
		request.timeout = 90_000;
		request.setRequestHeader('content-type', file.type);
		request.upload.onprogress = (event) => {
			if (event.lengthComputable && event.total > 0)
				progress(Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100))));
		};
		request.onload = () => {
			if (
				request.status < 200 ||
				request.status >= 300 ||
				(request.responseURL && request.responseURL !== url)
			) {
				reject(new Error('R2 upload failed. Check the bucket CORS policy.'));
				return;
			}
			progress(100);
			resolve();
		};
		request.onerror = () => reject(new Error('R2 upload failed. Check the bucket CORS policy.'));
		request.ontimeout = () => reject(new Error('R2 upload timed out. Retry the upload.'));
		request.onabort = () => reject(new Error('R2 upload was cancelled.'));
		progress(0);
		request.send(file);
	});
}
