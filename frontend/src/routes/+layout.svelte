<!-- @file +layout.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { applyTheme, getStoredTheme } from '../lib/theme.js';
	import CookieNotice from '../lib/components/CookieNotice.svelte';
	import { PROJECT_NAME } from '../lib/branding.js';

	let { children } = $props();

	onMount(() => {
		applyTheme(getStoredTheme());
	});
</script>

<svelte:head>
	<link rel="alternate" type="application/rss+xml" title={PROJECT_NAME} href="/rss.xml" />
</svelte:head>

{@render children()}
<CookieNotice />
