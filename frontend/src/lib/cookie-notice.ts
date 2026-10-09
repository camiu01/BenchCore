/**
 * @file cookie-notice.ts
 * @brief Remembers, on this device only, that the storage notice was acknowledged.
 */

/** localStorage key holding the acknowledgement; it never leaves the browser. */
export const NOTICE_KEY = 'cookie-notice';

/** Minimal storage surface, so tests need no DOM. */
export type NoticeStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * @brief Checks whether the visitor already acknowledged the notice.
 * @param storage Browser storage, or undefined during SSR.
 * @return True when no notice should be shown; unreadable storage also hides it.
 */
export function isNoticeAcknowledged(storage: NoticeStorage | undefined): boolean {
	if (storage === undefined) return true;
	try {
		return storage.getItem(NOTICE_KEY) === '1';
	} catch {
		return false;
	}
}

/**
 * @brief Records the acknowledgement; failures only mean the notice may reappear.
 * @param storage Browser storage, or undefined during SSR.
 * @return Nothing.
 */
export function acknowledgeNotice(storage: NoticeStorage | undefined): void {
	try {
		storage?.setItem(NOTICE_KEY, '1');
	} catch {
		// Storage is unavailable (private mode); the notice simply returns next visit.
	}
}
