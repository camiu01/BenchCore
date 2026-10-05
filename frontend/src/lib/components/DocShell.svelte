<!-- @file DocShell.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import ThemePicker from './ThemePicker.svelte';

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
	<div class="doc-meta-bar">
		<span class="doc-id">{docId}</span>
		<ThemePicker />
	</div>

	<header class="doc-header">
		<h1 class="doc-title">{title}</h1>
		<div class="doc-sub">{sub}</div>
		<nav class="doc-nav">
			{#each nav as item (item.href)}
				<a href={item.href} aria-current={item.href === activeHref ? 'page' : undefined}
					>{item.label}</a
				>
			{/each}
		</nav>
	</header>

	{@render children()}

	<footer class="doc-footer">
		<span>{footerLeft}</span>
		<span class="license-note">
			<a href="https://github.com/camiu01/BenchCore">AGPL-3.0 open source</a> ·
			<a href="https://www.gnu.org/licenses/agpl-3.0.html">License</a>
		</span>
		<span>{footerRight}</span>
	</footer>
</div>
