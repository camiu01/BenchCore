<!-- @file DocShell.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import LanguagePicker from './LanguagePicker.svelte';
	import ThemePicker from './ThemePicker.svelte';
	import { currentLocale, t } from '../i18n/t.svelte.js';
	import { navigationLabel } from '../presentation.js';

	/**
	 * Shared engineering-log sheet: meta bar, header, nav, footer.
	 * Every page renders its content into the default snippet.
	 */
	interface NavItem {
		href: string;
		label: string;
	}

	interface Props {
		docId: string;
		title: string;
		sub: string;
		nav: NavItem[];
		footerLeft: string;
		footerRight: string;
		wide?: boolean;
		activeHref?: string;
		children: Snippet;
	}

	let {
		docId,
		title,
		sub,
		nav,
		footerLeft,
		footerRight,
		wide = false,
		activeHref,
		children
	}: Props = $props();
</script>

<div class:wide class="wrapper">
	<a class="skip-link" href="#main-content">{t('common.skipToContent')}</a>
	<div class="doc-meta-bar">
		<span class="doc-id">{docId}</span>
		<div class="meta-controls">
			<LanguagePicker />
			<ThemePicker />
		</div>
	</div>

	<header class="doc-header">
		<h1 class="doc-title">{title}</h1>
		<div class="doc-sub">{sub}</div>
		<nav class="doc-nav" aria-label={t('common.mainNavigation')}>
			{#each nav as item (item.href)}
				<a href={item.href} aria-current={item.href === activeHref ? 'page' : undefined}
					>{navigationLabel(item.href, item.label, currentLocale())}</a
				>
			{/each}
		</nav>
	</header>

	<div id="main-content" tabindex="-1">
		{@render children()}
	</div>

	<footer class="doc-footer">
		<span>{footerLeft}</span>
		<span class="license-note">
			<a href="https://github.com/camiu01/BenchCore">{t('common.footer.license')}</a> ·
			<a href="https://www.gnu.org/licenses/agpl-3.0.html">{t('common.footer.licenseText')}</a> ·
			<a href="/cookies">{t('common.footer.cookies')}</a>
		</span>
		<span>{footerRight}</span>
	</footer>
</div>

<style>
	.meta-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 8px 18px;
		color: var(--muted);
	}
</style>
