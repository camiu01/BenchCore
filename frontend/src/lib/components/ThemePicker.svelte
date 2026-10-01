<script lang="ts">
	import { applyTheme, THEMES, type Theme } from '../theme.js';
	import { onMount } from 'svelte';

	let current: Theme = $state('light');

	onMount(() => {
		const stored = document.documentElement.getAttribute('data-theme');
		if (stored === 'light' || stored === 'dark' || stored === 'oled') {
			current = stored;
		}
	});

	/**
	 * Switches the site theme and updates the picker state.
	 * Presentation-only state, no business logic.
	 * @param theme - The theme to activate.
	 */
	function select(theme: Theme): void {
		applyTheme(theme);
		current = theme;
	}
</script>

<div class="theme-picker">
	<span>MODE:</span>
	{#each THEMES as theme (theme)}
		<button class="theme-btn" class:active={current === theme} onclick={() => select(theme)}
			>{theme}</button
		>
	{/each}
</div>
