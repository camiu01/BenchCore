/**
 * @file runtime.test.ts
 * @brief Regression coverage for runtime HTTP/HTTPS form origins and forged proxy headers.
 */
import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { applyRuntimeOrigin, runtimeSettings } from '../runtime.mjs';

describe('adapter runtime origin', () => {
	it('supports local HTTP and configured HTTPS without build-time origin injection', () => {
		expect(runtimeSettings({}).origin.origin).toBe('http://localhost:5180');
		expect(runtimeSettings({ SITE_URL: 'https://blog.example.test', PORT: '4000' })).toMatchObject({
			port: 4000
		});
		expect(runtimeSettings({ PUBLIC_SITE_URL: 'http://localhost:5180' }).origin.protocol).toBe(
			'http:'
		);
	});

	it('rejects credentials, malformed origins and invalid listening ports', () => {
		for (const SITE_URL of [
			'javascript:alert(1)',
			'https://a:b@example.test',
			'https://example.test/path'
		]) {
			expect(() => runtimeSettings({ SITE_URL })).toThrow();
		}
		for (const PORT of ['0', '65536', 'bad']) {
			expect(() => runtimeSettings({ PORT })).toThrow();
		}
	});

	it('overwrites spoofed adapter headers with the configured canonical origin', () => {
		const req = {
			headers: { 'x-platform-protocol': 'https', 'x-platform-host': 'evil.example.test' }
		} as unknown as IncomingMessage;
		applyRuntimeOrigin(req, new URL('http://localhost:5180'));
		expect(req.headers['x-platform-protocol']).toBe('http');
		expect(req.headers['x-platform-host']).toBe('localhost:5180');
	});
});
