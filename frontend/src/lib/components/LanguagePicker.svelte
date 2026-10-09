<!-- @file LanguagePicker.svelte @brief Cookie-backed language switch that works without JavaScript. -->
<script lang="ts">
	import { page } from '$app/state';
	import { LOCALES, LOCALE_NAMES } from '../i18n/locale.js';
	import { currentLocale, t } from '../i18n/t.svelte.js';

	const returnTo = $derived(page.url.pathname + page.url.search);
	const active = $derived(currentLocale());
</script>

<form class="lang-picker" method="POST" action="/language" aria-label={t('lang.groupLabel')}>
	<input type="hidden" name="return" value={returnTo} />
	<span>{t('lang.label')}</span>
	{#each LOCALES as code (code)}
		<button
			class="theme-btn"
			class:active={active === code}
			type="submit"
			name="lang"
			value={code}
			lang={code}
			aria-pressed={active === code}
			aria-label={t('lang.switchTo', { name: LOCALE_NAMES[code] })}>{code}</button
		>
	{/each}
</form>

<style>
	.lang-picker {
		display: flex;
		align-items: center;
		gap: 4px;
		margin: 0;
		font-size: 11px;
		letter-spacing: 0.5px;
	}
	.lang-picker span {
		margin-right: 4px;
	}
</style>
