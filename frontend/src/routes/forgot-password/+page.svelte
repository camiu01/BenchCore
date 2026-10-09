<!-- @file +page.svelte @brief Public password recovery request form. -->
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
	title={t('auth.forgot.seoTitle')}
	description={t('auth.forgot.seoDescription')}
	canonical="{data.siteBase}/forgot-password"
/>
<DocShell
	docId="FORM: BENCHCORE-2026 // REF: RECOVERY"
	title={t('auth.forgot.title')}
	sub={t('auth.forgot.sub')}
	{nav}
	footerLeft={t('auth.forgot.footerLeft')}
	footerRight={t('auth.forgot.footerRight')}
>
	<main>
		<article class="record">
			<div class="record-header"><span class="record-title">{t('auth.forgot.heading')}</span></div>
			{#if form?.error}<p class="error-stamp" role="alert">{form.error}</p>{/if}
			{#if form?.success}
				<p class="summary" role="status">
					{t('auth.forgot.sent')}
				</p>
				<p class="summary">{t('auth.forgot.sentHelp')}</p>
				<a class="btn" href="/login">{t('auth.forgot.back')}</a>
			{:else}
				<form method="POST" class="form-grid">
					<label class="field-label" for="email">{t('auth.forgot.email')}</label>
					<input
						class="field-input"
						id="email"
						name="email"
						type="email"
						required
						maxlength="254"
						autocomplete="email"
						value={form?.email ?? ''}
					/>
					<div class="btn-row">
						<button class="btn btn-accent" type="submit">{t('auth.forgot.submit')}</button>
					</div>
				</form>
			{/if}
		</article>
	</main>
</DocShell>
