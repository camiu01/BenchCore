/**
 * @file cookie-notice.test.ts
 * @brief The notice stays hidden once acknowledged and never breaks on blocked storage.
 */
import { describe, expect, it } from 'vitest';
import { NOTICE_KEY, acknowledgeNotice, isNoticeAcknowledged } from '../src/lib/cookie-notice.js';

/** @brief Builds an in-memory storage. @return Storage double and its backing map. */
function memory() {
	const values = new Map<string, string>();
	return {
		values,
		storage: {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => void values.set(key, value)
		}
	};
}

describe('cookie notice', () => {
	it('shows on first visit and hides after acknowledgement', () => {
		const { storage, values } = memory();
		expect(isNoticeAcknowledged(storage)).toBe(false);
		acknowledgeNotice(storage);
		expect(values.get(NOTICE_KEY)).toBe('1');
		expect(isNoticeAcknowledged(storage)).toBe(true);
	});

	it('stays hidden during SSR', () => {
		expect(isNoticeAcknowledged(undefined)).toBe(true);
		expect(() => acknowledgeNotice(undefined)).not.toThrow();
	});

	it('survives blocked storage', () => {
		const blocked = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		};
		expect(isNoticeAcknowledged(blocked)).toBe(false);
		expect(() => acknowledgeNotice(blocked)).not.toThrow();
	});
});
