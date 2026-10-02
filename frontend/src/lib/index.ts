/**
 * @file index.ts
 * @brief Public homepage identity and engineering-log description.
 * Post data is loaded from the standalone API.
 */
import { PROJECT_NAME, PROJECT_TITLE } from './branding.js';

/** Homepage data returned by the page server load function. */
export interface HomepageData {
	title: string;
	description: string;
}

/**
 * @brief Returns static identity data for the public homepage.
 * @returns The homepage title and description.
 */
export function getHomepageData(): HomepageData {
	return {
		title: PROJECT_NAME,
		description: PROJECT_TITLE
	};
}
