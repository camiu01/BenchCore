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
		children: Snippet;
	}

	let { docId, title, sub, nav, footerLeft, footerRight, children }: Props = $props();
</script>

<div class="wrapper">
	<div class="doc-meta-bar">
		<span class="doc-id">{docId}</span>
		<ThemePicker />
	</div>

	<header class="doc-header">
		<h1 class="doc-title">{title}</h1>
		<div class="doc-sub">{sub}</div>
		<nav class="doc-nav">
			{#each nav as item (item.href)}
				<a href={item.href}>{item.label}</a>
			{/each}
		</nav>
	</header>

	{@render children()}

	<footer class="doc-footer">
		<span>{footerLeft}</span>
		<span>{footerRight}</span>
	</footer>
</div>
