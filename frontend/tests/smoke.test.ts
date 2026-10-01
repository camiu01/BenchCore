/**
 * Scaffolding smoke test.
 * Proves Vitest is wired correctly. Domain tests arrive in Milestone 2+.
 */
import { describe, expect, it } from 'vitest';
import { getHomepageData } from '../src/lib/index.js';

describe('scaffolding', () => {
	it('returns homepage placeholder data', () => {
		const data = getHomepageData();
		expect(data.title).toBe('Personal Publishing Platform');
		expect(data.description).toContain('Milestone 1');
	});
});
