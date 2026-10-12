/**
 * @file totp-qr.ts
 * @brief Local authenticator QR encoding into numeric SVG paths, without HTML or external services.
 */
import { create } from 'qrcode';

export interface TotpQrGraphic {
	size: number;
	path: string;
}

/**
 * @brief Encodes one row as contiguous black module runs inside a four-module quiet zone.
 * @param qr Encoded QR matrix.
 * @param row Matrix row.
 * @return Numeric SVG path commands.
 */
function rowPath(qr: ReturnType<typeof create>, row: number): string {
	let path = '';
	let column = 0;
	while (column < qr.modules.size) {
		if (!qr.modules.get(row, column)) {
			column++;
			continue;
		}
		const start = column;
		while (column < qr.modules.size && qr.modules.get(row, column)) {
			column++;
		}
		const width = column - start;
		path += `M${start + 4} ${row + 4}h${width}v1h-${width}z`;
	}
	return path;
}

/**
 * @brief Generates a crisp QR graphic from a validated, bounded authenticator URI.
 * @param uri Private otpauth URI from confirmed enrollment.
 * @return Serializable SVG geometry, with no external image URL.
 */
export function createTotpQr(uri: string): TotpQrGraphic {
	if (uri.length > 1024) {
		throw new Error('Authenticator URI exceeds the QR limit');
	}
	const qr = create(uri, { errorCorrectionLevel: 'M' });
	let path = '';
	for (let row = 0; row < qr.modules.size; row++) {
		path += rowPath(qr, row);
	}
	return { size: qr.modules.size + 8, path };
}
