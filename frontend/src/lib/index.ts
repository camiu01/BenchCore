/**
 * Placeholder page data for the Milestone 1 scaffolding homepage.
 * Real post loading is introduced in Milestone 4 (public site).
 */

/** Homepage data returned by the page server load function. */
export interface HomepageData {
	title: string;
	description: string;
}

/**
 * Returns static placeholder data for the scaffolding homepage.
 * @returns The homepage title and description.
 */
export function getHomepageData(): HomepageData {
	return {
		title: 'Personal Publishing Platform',
		description: 'Milestone 1 scaffolding is running. Blog content arrives in later milestones.'
	};
}
