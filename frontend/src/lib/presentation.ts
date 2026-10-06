/**
 * @file presentation.ts
 * @brief Reader-facing navigation labels and deterministic publication dates.
 */
const navigationLabels = new Map([
	['/', 'Home'],
	['/posts', 'Posts'],
	['/tags', 'Topics'],
	['/graph', 'Connections'],
	['/login', 'Sign in'],
	['/register', 'Create account'],
	['/account', 'My account'],
	['/admin', 'Administration'],
	['/admin/posts/new', 'New post'],
	['/admin/tags', 'Manage tags'],
	['/admin/users', 'Manage users'],
	['/admin/comments', 'Review comments']
]);

/** @brief Names a navigation destination in plain language. @param href Destination URL. @param fallback Custom label. @return Reader-facing label. */
export function navigationLabel(href: string, fallback: string): string {
	return navigationLabels.get(href.split('?')[0] ?? href) ?? fallback;
}

/** @brief Formats a publication date consistently in SSR and browsers. @param value ISO timestamp or null. @return Human-readable UTC date. */
export function publicationDate(value: string | null): string {
	if (!value) return 'Date unavailable';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return 'Date unavailable';
	return new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(date);
}
