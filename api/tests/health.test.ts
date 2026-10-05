/**
 * @file health.test.ts
 * @brief Integration tests for the API health endpoint and error responses.
 */
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHandler, parsePort, startServer } from '../src/server.js';
import { createTestDeps, createTestRepos } from './helpers.js';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
	server = startServer(0, createHandler(createTestDeps(createTestRepos())));
	await new Promise<void>((resolve) => server.once('listening', resolve));
	const address = server.address() as AddressInfo;
	baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve()))
	);
});

describe('GET /health', () => {
	it('returns ok status with service name', async () => {
		const response = await fetch(`${baseUrl}/health`);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('application/json');
		expect(await response.json()).toEqual({ status: 'ok', service: 'benchcore-api', license: 'AGPL-3.0-or-later' });
	});

	it('returns JSON 404 for unknown routes', async () => {
		const response = await fetch(`${baseUrl}/nope`);
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: 'not_found' });
	});

	it('returns JSON 405 for wrong methods on known routes', async () => {
		const response = await fetch(`${baseUrl}/health`, { method: 'POST', headers: { origin: 'http://localhost:5173' } });
		expect(response.status).toBe(405);
		expect(await response.json()).toEqual({ error: 'method_not_allowed' });
	});
});

describe('parsePort', () => {
	it('falls back for missing or invalid values', () => {
		expect(parsePort(undefined, 3001)).toBe(3001);
		expect(parsePort('', 3001)).toBe(3001);
		expect(parsePort('abc', 3001)).toBe(3001);
		expect(parsePort('0', 3001)).toBe(3001);
		expect(parsePort('99999', 3001)).toBe(3001);
	});

	it('accepts valid ports', () => {
		expect(parsePort('3001', 0)).toBe(3001);
	});
});
