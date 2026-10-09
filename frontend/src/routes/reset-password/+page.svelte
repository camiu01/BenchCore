<!-- @file +page.svelte @brief Public form for choosing a password from a recovery link. -->
<script lang="ts">
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import { t } from '../../lib/i18n/t.svelte.js';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	const nav = [
		{ href: '/login', label: '[01] login' },
		{ href: '/', label: '[02] index' }
	];
</script>

<Seo
	title={t('auth.reset.seoTitle')}
	description={t('auth.reset.seoDescription')}
	canonical="{data.siteBase}/reset-password"
/>
<DocShell
	docId="FORM: BENCHCORE-2026 // REF: RESET"
	title={t('auth.reset.title')}
	sub={t('auth.reset.sub')}
	{nav}
	footerLeft={t('auth.reset.footerLeft')}
	footerRight={t('auth.reset.footerRight')}
>
	<main>
		<article class="record">
			<div class="record-header"><span class="record-title">{t('auth.reset.heading')}</span></div>
			{#if form?.error}<p class="error-stamp" role="alert">{form.error}</p>{/if}
			{#if data.token}
				<form method="POST" class="form-grid">
					<input type="hidden" name="token" value={data.token} />
					<label class="field-label" for="newPassword">{t('auth.reset.newPassword')}</label>
					<input
						class="field-input"
						id="newPassword"
						name="newPassword"
						type="password"
						required
						minlength="8"
						maxlength="200"
						autocomplete="new-password"
					/>
					<label class="field-label" for="confirmation">{t('auth.reset.confirmation')}</label>
					<input
						class="field-input"
						id="confirmation"
						name="confirmation"
						type="password"
						required
						minlength="8"
						maxlength="200"
						autocomplete="new-password"
					/>
					<div class="btn-row">
						<button class="btn btn-accent" type="submit">{t('auth.reset.submit')}</button>
					</div>
				</form>
			{:else}
				<p class="error-stamp" role="alert">{t('auth.reset.invalidLink')}</p>
				<a class="btn" href="/forgot-password">{t('auth.reset.requestNew')}</a>
			{/if}
		</article>
	</main>
</DocShell>
