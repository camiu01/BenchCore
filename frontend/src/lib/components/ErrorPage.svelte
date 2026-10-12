<!-- @file ErrorPage.svelte @brief Safe, localized error recovery with real archive navigation and search. -->
<script lang="ts">
	import DocShell from './DocShell.svelte';
	import Seo from './Seo.svelte';
	import { errorCopy } from '../error-page.js';
	import { t } from '../i18n/t.svelte.js';

	let { status }: { status: number } = $props();
	const copy = $derived(errorCopy(status));
	const nav = $derived([
		{ href: '/', label: `[01] ${t('public.nav.index')}` },
		{ href: '/posts', label: `[02] ${t('public.nav.records')}` },
		{ href: '/tags', label: `[03] ${t('public.nav.tags')}` },
		{ href: '/help', label: `[04] ${t('pages.help.label')}` }
	]);

	/** @brief Retries the current request without generating a URL from error input. @return Nothing. */
	function reloadPage(): void {
		window.location.reload();
	}
</script>

<Seo
	title="{status} | {t(copy.title)} | BenchCore"
	description={t(copy.description)}
	noindex
	type="website"
/>
<DocShell
	docId={t('public.docId', { ref: `HTTP ${status}` })}
	title={t(copy.title)}
	sub={t(copy.description)}
	{nav}
	footerLeft="BENCHCORE"
	footerRight={`HTTP ${status}`}
>
	<main>
		<section class="record error-record">
			<p class="status-code" aria-hidden="true">{status}</p>
			<p class="summary">{t(copy.body)}</p>
			<div class="recovery-links">
				<a class="btn" href="/">{t('pages.error.home')}</a>
				<a class="btn" href="/posts">{t('pages.error.archive')}</a>
				{#if status === 401 || status === 403}
					<a class="btn" href="/login">{t('pages.error.signIn')}</a>
				{:else if status !== 404}
					<button class="btn" type="button" onclick={reloadPage}>{t('pages.error.retry')}</button>
				{/if}
			</div>
		</section>
		{#if status === 404}
			<section class="record">
				<form class="error-search" method="GET" action="/posts">
					<label class="field-label" for="missing-page-search">{t('pages.error.searchLabel')}</label
					>
					<div class="search-controls">
						<input
							class="field-input"
							id="missing-page-search"
							name="search"
							type="search"
							maxlength="200"
							placeholder={t('pages.error.searchPlaceholder')}
						/>
						<button class="btn" type="submit">{t('pages.error.searchSubmit')}</button>
					</div>
				</form>
			</section>
		{/if}
	</main>
</DocShell>

<style>
	.status-code {
		margin: 0 0 16px;
		color: var(--accent);
		font-family: var(--font-mono, monospace);
		font-size: clamp(64px, 18vw, 128px);
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.06em;
	}
	.recovery-links,
	.search-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 16px;
	}
	.search-controls .field-input {
		flex: 1 1 200px;
		min-width: 0;
	}
</style>
