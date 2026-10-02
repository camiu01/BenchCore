/**
 * @file smoke.test.ts
 * @brief Canonical BenchCore homepage identity regression coverage.
 */
import { describe, expect, it } from 'vitest';
import { getHomepageData } from '../src/lib/index.js';

describe('BenchCore identity', () => {
	it('returns homepage identity data', () => {
		const data = getHomepageData();
		expect(data.title).toBe('BenchCore');
		expect(data.description).toBe(
			'Bench-testing, Embedded Networks, & Circuit Hacks: Centralized Open-source Research Engine'
		);
	});
});
