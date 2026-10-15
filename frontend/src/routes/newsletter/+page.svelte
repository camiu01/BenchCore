<!-- @file +page.svelte @brief Explicit opt-in newsletter subscription, separate from account creation. -->
<script lang="ts">
	import DocShell from '../../lib/components/DocShell.svelte';
	import { t } from '../../lib/i18n/t.svelte.js';
	import type { PageData, ActionData } from './$types';
	let { data, form }: { data: PageData; form?: ActionData } = $props();
	const nav = $derived([{ href: '/', label: t('public.nav.index') }]);
</script>
<DocShell title={t('newsletter.title')} sub={t('newsletter.intro')} {nav}
	docId="FORM: NEWSLETTER" footerLeft="BenchCore" footerRight={t('newsletter.noAccount')}>
	<main>
		<article class="record">
			<h2>{t('newsletter.subscribe')}</h2>
			<p>{t('newsletter.privacy')}</p>
			<p><a href="/privacy">{t('pages.privacy.label')}</a></p>
			{#if form?.accepted}<p class="summary" role="status">{t('newsletter.requested')}</p>
			{:else}
				{#if form && !form.accepted}<p class="error-stamp" role="alert">{t('newsletter.failed')}</p>{/if}
				{#if !data.enabled}<p role="status">{t('newsletter.disabled')}</p>{/if}
				<form method="POST" class="form-grid">
					<label class="field-label" for="newsletter-email">{t('newsletter.email')}</label>
					<input class="field-input" id="newsletter-email" name="email" type="email" maxlength="254" autocomplete="email" required />
					<div class="honeypot" aria-hidden="true">
						<label for="newsletter-website">Website</label>
						<input id="newsletter-website" name="website" tabindex="-1" autocomplete="off" />
					</div>
					<label><input type="checkbox" name="consent" value="yes" required /> {t('newsletter.consent')}</label>
					<button class="btn btn-accent" type="submit" disabled={!data.enabled}>{t('newsletter.subscribe')}</button>
				</form>
			{/if}
		</article>
	</main>
</DocShell>
<style>
	.honeypot { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
