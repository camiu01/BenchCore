<!-- @file ThemePicker.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import { applyTheme, THEMES, type Theme } from '../theme.js';
	import { onMount } from 'svelte';
	import { t } from '../i18n/t.svelte.js';

	let current: Theme = $state('light');

	onMount(() => {
		const stored = document.documentElement.getAttribute('data-theme');
		if (stored === 'light' || stored === 'dark' || stored === 'oled') {
			current = stored;
		}
	});

	/**
	 * @brief Switches the site theme and updates the picker state.
	 * Presentation-only state, no business logic.
	 * @param theme - The theme to activate.
	 * @return The result, or a redirect for completed mutations.
	 */
	function select(theme: Theme): void {
		applyTheme(theme);
		current = theme;
	}
</script>

<div class="theme-picker">
	<span>{t('theme.mode')}</span>
	{#each THEMES as theme (theme)}
		<button class="theme-btn" class:active={current === theme} onclick={() => select(theme)}
			>{t(`theme.${theme}`)}</button
		>
	{/each}
</div>
