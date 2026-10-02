<!-- @file +layout.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { applyTheme, getStoredTheme } from '../lib/theme.js';

	let { children } = $props();

	onMount(() => {
		applyTheme(getStoredTheme());
	});
</script>

{@render children()}
