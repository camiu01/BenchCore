<!-- @file +layout.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { applyTheme, getStoredTheme } from '../lib/theme.js';
	import CookieNotice from '../lib/components/CookieNotice.svelte';

	let { children } = $props();

	onMount(() => {
		applyTheme(getStoredTheme());
	});
</script>

{@render children()}
<CookieNotice />
