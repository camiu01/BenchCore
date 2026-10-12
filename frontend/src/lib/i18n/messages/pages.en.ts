/**
 * @file pages.en.ts
 * @brief Public information, recovery pages and footer vocabulary.
 */
export const pagesEn = {
	'pages.footer.navigation': 'Site information and feeds',
	'pages.about.label': 'About',
	'pages.help.label': 'Help',
	'pages.privacy.label': 'Privacy',
	'pages.cookies.label': 'Cookies',
	'pages.rss.label': 'RSS feed',
	'pages.sitemap.label': 'Sitemap',
	'pages.about.title': 'About BenchCore',
	'pages.about.description':
		'Research notes, embedded systems and circuit experiments in an open-source engineering log.',
	'pages.about.intro':
		'Bench-testing, Embedded Networks, & Circuit Hacks: Centralized Open-source Research Engine.',
	'pages.about.researchTitle': 'A place for research notes',
	'pages.about.research':
		'BenchCore brings engineering notes and experiments into a searchable archive. Articles can connect through topics, related records and links, so you can follow an idea across more than one post.',
	'pages.about.readingTitle': 'Read and explore',
	'pages.about.reading':
		'Browse the archive, search for a subject or explore the connection graph. Public records are open to everyone. Some published records require a reader account; drafts and archived records are not public.',
	'pages.about.sourceTitle': 'Open-source software',
	'pages.about.source':
		'The platform source is available under the GNU AGPL-3.0-or-later license. It is built with SvelteKit, a TypeScript API and PostgreSQL. There are no built-in advertising or analytics scripts.',
	'pages.about.rights':
		'For reuse of an article or attachment, check the license stated by its author. The software license is not a blanket permission for every upload.',
	'pages.about.sourceLink': 'View the source',
	'pages.help.title': 'Reader guide',
	'pages.help.description':
		'Find articles, follow connections, use your account and recover from common problems.',
	'pages.help.intro':
		'A few useful routes through the archive, plus help with accounts and comments.',
	'pages.help.findTitle': 'Find a record',
	'pages.help.find':
		'Search the archive by title or subject. Combine topic filters with AND to require every selected topic, or OR to match any of them. You can also browse topics or use the graph to follow connected records.',
	'pages.help.accountTitle': 'Accounts and restricted records',
	'pages.help.account':
		'Register a reader account to open reader-only articles. Change your password in Account. Account security lets you sign out on every device; administrators can also set up an authenticator.',
	'pages.help.recovery':
		'Forgot your password? Request a recovery link. Email recovery must be enabled by the site operator. If it is unavailable, ask the operator for help. Never share passwords, session cookies or recovery links.',
	'pages.help.commentsTitle': 'Comments and likes',
	'pages.help.comments':
		'Comments enter a moderation queue and become public only after approval. Submit the information you are comfortable sharing publicly. Likes use a first-party browser cookie, not an advertising account.',
	'pages.help.feedTitle': 'Follow new records',
	'pages.help.feed':
		'Add the RSS feed to your preferred reader to follow published records. Reader-only records may appear with a public title, but their protected text is not included for guests.',
	'pages.help.problemTitle': 'Something is not working?',
	'pages.help.problem':
		'Check your connection and try again. If a record is missing, it may have moved or no longer be public. For a software bug, use the project issue tracker and include the page, steps and a screenshot with private information removed.',
	'pages.help.issuesLink': 'Report a software bug',
	'pages.help.passwordLink': 'Recover a password',
	'pages.help.accountLink': 'Open your account',
	'pages.privacy.title': 'Privacy and data',
	'pages.privacy.description':
		'What the BenchCore application stores, what stays public and how browser preferences work.',
	'pages.privacy.intro':
		'This page describes the application’s data handling. Hosting, email and storage providers may have their own policies.',
	'pages.privacy.accountTitle': 'Account and security data',
	'pages.privacy.account':
		'An account stores its username, email, display name, role and account status. Passwords are stored as hashes. Session and recovery tokens are stored as hashes, and administrator authenticator secrets are encrypted.',
	'pages.privacy.audit':
		'The security log contains event names, actor and target identifiers, counts and timestamps. It does not record passwords, tokens, email addresses, IP addresses or article bodies. Only administrators can view it.',
	'pages.privacy.publicTitle': 'Public contributions',
	'pages.privacy.public':
		'Approved comments show the submitted name, text and date. Article content and attachments can also be public. Do not put private contact details or secrets in a contribution intended for publication.',
	'pages.privacy.likes':
		'Likes store a hash derived from a browser token. Comment submission limits temporarily track IP addresses and session-token hashes in process memory; these counters are not part of the security log.',
	'pages.privacy.browserTitle': 'Browser storage',
	'pages.privacy.browser':
		'First-party cookies support login, language selection and likes. Local storage remembers your theme and whether you dismissed the cookie notice. BenchCore does not include advertising or analytics scripts.',
	'pages.privacy.providersTitle': 'Hosting and external resources',
	'pages.privacy.providers':
		'The host or reverse proxy can keep access logs. Password recovery, when enabled, sends email through the configured provider. Images may come from configured object storage or an external URL; opening them can send a request to that provider.',
	'pages.privacy.controlTitle': 'Your choices',
	'pages.privacy.control':
		'You can sign out, revoke all device sessions, change your password and clear browser storage. Clearing cookies does not delete your account or published contributions. For account or content removal, contact the operator of this installation; there is no automatic deletion form.',
	'pages.privacy.warning':
		'Do not post private account details, passwords or recovery links in the public issue tracker.',
	'pages.error.notFoundTitle': 'Page not found',
	'pages.error.notFoundDescription':
		'This address does not point to a public page. Start again from the archive or search for a record.',
	'pages.error.notFoundBody':
		'The link may be outdated, or the record may no longer be public. Check the address or use one of the routes below.',
	'pages.error.unavailableTitle': 'This page is unavailable',
	'pages.error.unavailableDescription':
		'The request could not be completed. Try again or return to the archive.',
	'pages.error.unavailableBody':
		'The site could not complete this request. Try reloading the page. If the problem continues, the reader guide has recovery steps.',
	'pages.error.deniedTitle': 'Access not available',
	'pages.error.deniedDescription': 'Your account cannot open this page.',
	'pages.error.deniedBody':
		'Sign in with an account that has access, or return to the public archive.',
	'pages.error.home': 'Back to index',
	'pages.error.archive': 'Browse articles',
	'pages.error.searchLabel': 'Search the archive',
	'pages.error.searchPlaceholder': 'Title or subject',
	'pages.error.searchSubmit': 'Search',
	'pages.error.retry': 'Reload this page',
	'pages.error.signIn': 'Sign in',
	'pages.cookies.likePurpose':
		'Remembers whether this browser liked a record. Created when you first use the like button.',
	'pages.cookies.likeDuration': 'Up to 1 year, or until you clear site data'
} as const;
