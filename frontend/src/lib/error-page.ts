/**
 * @file error-page.ts
 * @brief Safe presentation copy for errors, without reflecting upstream messages or request input.
 */
import type { MessageKey } from './i18n/translate.js';

interface ErrorCopy {
	title: MessageKey;
	description: MessageKey;
	body: MessageKey;
}

/** @brief Selects safe recovery text for an HTTP status. @param status Response status. @return Localized message keys. */
export function errorCopy(status: number): ErrorCopy {
	if (status === 404) {
		return {
			title: 'pages.error.notFoundTitle',
			description: 'pages.error.notFoundDescription',
			body: 'pages.error.notFoundBody'
		};
	}
	if (status === 401 || status === 403) {
		return {
			title: 'pages.error.deniedTitle',
			description: 'pages.error.deniedDescription',
			body: 'pages.error.deniedBody'
		};
	}
	return {
		title: 'pages.error.unavailableTitle',
		description: 'pages.error.unavailableDescription',
		body: 'pages.error.unavailableBody'
	};
}
