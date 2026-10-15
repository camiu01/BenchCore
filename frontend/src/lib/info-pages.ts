/**
 * @file info-pages.ts
 * @brief Typed editorial content and fixed destinations for public information pages.
 */
import type { MessageKey } from './i18n/translate.js';

interface InformationLink {
	href: string;
	label: MessageKey;
}
interface InformationSection {
	heading: MessageKey;
	paragraphs: readonly MessageKey[];
	links?: readonly InformationLink[];
}
export interface InformationPage {
	ref: string;
	path: string;
	title: MessageKey;
	description: MessageKey;
	intro: MessageKey;
	sections: readonly InformationSection[];
}

export const INFO_PAGES = {
	about: {
		ref: 'ABOUT',
		path: '/about',
		title: 'pages.about.title',
		description: 'pages.about.description',
		intro: 'pages.about.intro',
		sections: [
			{ heading: 'pages.about.researchTitle', paragraphs: ['pages.about.research'] },
			{
				heading: 'pages.about.readingTitle',
				paragraphs: ['pages.about.reading'],
				links: [
					{ href: '/posts', label: 'pages.error.archive' },
					{ href: '/graph', label: 'public.nav.graph' }
				]
			},
			{
				heading: 'pages.about.sourceTitle',
				paragraphs: ['pages.about.source', 'pages.about.rights'],
				links: [{ href: 'https://github.com/camiu01/BenchCore', label: 'pages.about.sourceLink' }]
			}
		]
	},
	help: {
		ref: 'HELP',
		path: '/help',
		title: 'pages.help.title',
		description: 'pages.help.description',
		intro: 'pages.help.intro',
		sections: [
			{
				heading: 'pages.help.findTitle',
				paragraphs: ['pages.help.find'],
				links: [
					{ href: '/posts', label: 'pages.error.archive' },
					{ href: '/tags', label: 'public.nav.tags' }
				]
			},
			{
				heading: 'pages.help.accountTitle',
				paragraphs: ['pages.help.account', 'pages.help.recovery'],
				links: [
					{ href: '/account', label: 'pages.help.accountLink' },
					{ href: '/forgot-password', label: 'pages.help.passwordLink' }
				]
			},
			{ heading: 'pages.help.commentsTitle', paragraphs: ['pages.help.comments'] },
			{
				heading: 'pages.help.feedTitle',
				paragraphs: ['pages.help.feed'],
				links: [{ href: '/rss.xml', label: 'pages.rss.label' }]
			},
			{
				heading: 'pages.help.problemTitle',
				paragraphs: ['pages.help.problem'],
				links: [
					{ href: 'https://github.com/camiu01/BenchCore/issues', label: 'pages.help.issuesLink' }
				]
			}
		]
	},
	privacy: {
		ref: 'PRIVACY',
		path: '/privacy',
		title: 'pages.privacy.title',
		description: 'pages.privacy.description',
		intro: 'pages.privacy.intro',
		sections: [
			{
				heading: 'pages.privacy.accountTitle',
				paragraphs: ['pages.privacy.account', 'pages.privacy.audit']
			},
			{
				heading: 'pages.privacy.publicTitle',
				paragraphs: ['pages.privacy.public', 'pages.privacy.likes']
			},
			{
				heading: 'pages.privacy.browserTitle',
				paragraphs: ['pages.privacy.browser'],
				links: [{ href: '/cookies', label: 'pages.cookies.label' }]
			},
			{ heading: 'newsletter.title', paragraphs: ['newsletter.data'],
				links: [{ href: '/newsletter', label: 'newsletter.title' }] },
			{ heading: 'pages.privacy.providersTitle', paragraphs: ['pages.privacy.providers'] },
			{
				heading: 'pages.privacy.controlTitle',
				paragraphs: ['pages.privacy.control', 'pages.privacy.warning'],
				links: [
					{ href: '/account/security', label: 'security.title' },
					{ href: '/help', label: 'pages.help.label' }
				]
			}
		]
	}
} as const satisfies Record<string, InformationPage>;
