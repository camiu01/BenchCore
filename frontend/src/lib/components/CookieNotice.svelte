<!-- @file CookieNotice.svelte @brief Non-blocking notice about the only browser storage BenchCore uses. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '../i18n/t.svelte.js';
	import { acknowledgeNotice, isNoticeAcknowledged } from '../cookie-notice.js';

	let visible = $state(false);

	onMount(() => {
		const storage = typeof localStorage === 'undefined' ? undefined : localStorage;
		visible = !isNoticeAcknowledged(storage);
	});

	/** @brief Hides the notice and remembers the choice on this device. @return Nothing. */
	function accept(): void {
		acknowledgeNotice(typeof localStorage === 'undefined' ? undefined : localStorage);
		visible = false;
	}
</script>

{#if visible}
	<section class="cookie-notice" aria-labelledby="cookie-notice-title">
		<div class="cookie-heading">
			<h2 id="cookie-notice-title">{t('cookieNotice.title')}</h2>
			<span class="stamp">{t('cookieNotice.stamp')}</span>
		</div>
		<p>{t('cookieNotice.body')}</p>
		<div class="btn-row">
			<button class="btn btn-accent" type="button" onclick={accept}
				>{t('cookieNotice.accept')}</button
			>
			<a class="btn" href="/cookies">{t('cookieNotice.details')}</a>
		</div>
	</section>
{/if}

<style>
	.cookie-notice {
		position: fixed;
		left: 16px;
		bottom: 16px;
		z-index: 40;
		width: min(420px, calc(100vw - 32px));
		box-sizing: border-box;
		padding: 16px;
		border: 2px solid var(--border);
		background: var(--sheet-bg);
		color: var(--ink);
		box-shadow: 6px 6px 0 var(--shadow-ink);
	}
	.cookie-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border-bottom: 2px solid var(--border);
		padding-bottom: 8px;
	}
	h2 {
		margin: 0;
		font-size: 14px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	p {
		margin: 12px 0 0;
		font-size: 13px;
		line-height: 1.7;
	}
	.cookie-notice :global(.btn) {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
</style>
