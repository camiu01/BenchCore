/**
 * @file site-pages.ts
 * @brief Explicit public page inventory shared by sitemap generation and site information links.
 */
import type { MessageKey } from './i18n/translate.js';

export const PUBLIC_SITE_PATHS = [
	'/',
	'/posts',
	'/tags',
	'/graph',
	'/about',
	'/help',
	'/privacy',
	'/cookies'
] as const;

export const FOOTER_LINKS = [
	{ href: '/about', label: 'pages.about.label' },
	{ href: '/help', label: 'pages.help.label' },
	{ href: '/privacy', label: 'pages.privacy.label' },
	{ href: '/cookies', label: 'pages.cookies.label' },
	{ href: '/rss.xml', label: 'pages.rss.label' },
	{ href: '/sitemap.xml', label: 'pages.sitemap.label' }
] as const satisfies readonly { href: string; label: MessageKey }[];
