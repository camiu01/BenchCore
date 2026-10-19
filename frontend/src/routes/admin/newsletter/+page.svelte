<!-- @file +page.svelte @brief Preview-first newsletter drafts with deliberate manual batch approval. -->
<script lang="ts">
	import DocShell from '../../../lib/components/DocShell.svelte';
	import Seo from '../../../lib/components/Seo.svelte';
	import { t } from '../../../lib/i18n/t.svelte.js';
	import type { PageData, ActionData } from './$types';
	let { data, form }: { data: PageData; form?: ActionData } = $props();
	const nav = $derived([
		{ href: '/admin', label: t('vault.back') },
		{ href: '/newsletter', label: t('newsletter.subscribe') }
	]);
</script>

<Seo
	title={t('newsletter.title')}
	description={t('newsletter.adminIntro')}
	type="website"
	noindex
/>

<DocShell
	title={t('newsletter.title')}
	sub={t('newsletter.adminIntro')}
	{nav}
	docId="FORM: NEWSLETTER-ADMIN"
	footerLeft="BenchCore"
	footerRight="Newsletter"
	wide
>
	<main>
		{#if form?.ok === false}<p class="error-stamp" role="alert">{t('newsletter.failed')}</p>{/if}
		{#if form?.ok === true}<p role="status">{t('newsletter.saved')}</p>{/if}
		{#if !data.dashboard}<p role="alert">{t('newsletter.failed')}</p>
		{:else}
			{#if !data.dashboard.enabled}<p class="summary">{t('newsletter.disabled')}</p>{/if}
			<p class="stamp">{t('newsletter.recipients', { count: data.dashboard.confirmed })}</p>
			<article class="record">
				<h2>{t('newsletter.draft')}</h2>
				<form method="POST" action="?/draft" class="form-grid">
					<label class="field-label" for="newsletter-subject">{t('newsletter.subject')}</label>
					<input
						class="field-input"
						id="newsletter-subject"
						name="subject"
						maxlength="200"
						required
						value={form?.values?.subject ?? ''}
					/>
					<label class="field-label" for="newsletter-body">{t('newsletter.body')}</label>
					<textarea
						class="field-input"
						id="newsletter-body"
						name="body"
						rows="10"
						maxlength="20000"
						required>{form?.values?.body ?? ''}</textarea
					>
					<p class="field-help">{t('newsletter.draftHelp')}</p>
					<button class="btn" type="submit">{t('newsletter.preview')}</button>
				</form>
			</article>
			{#each data.dashboard.items as campaign (campaign.id)}
				<article class="record">
					<h2>{campaign.subject}</h2>
					<span class="stamp">{t(`newsletter.status.${campaign.status}`)}</span>
					<div class="newsletter-preview">{campaign.body}</div>
					<p class="field-help">{t('newsletter.footerPreview')}</p>
					<p>{t('newsletter.counts', campaign.stats)}</p>
					{#if campaign.stats.sending}<p role="status">{t('newsletter.inflight')}</p>{/if}
					{#if campaign.status === 'draft' || campaign.stats.queued > 0}
						<form method="POST" action="?/send" class="form-grid">
							<input type="hidden" name="id" value={campaign.id} />
							<label
								><input type="checkbox" name="approved" value="yes" required />
								{t('newsletter.approve')}</label
							>
							<label class="field-label" for="send-{campaign.id}">{t('newsletter.typeSend')}</label>
							<input
								class="field-input"
								id="send-{campaign.id}"
								name="confirmation"
								required
								pattern="SEND"
								autocomplete="off"
							/>
							<button class="btn btn-accent" type="submit" disabled={!data.dashboard.enabled}
								>{t('newsletter.sendBatch')}</button
							>
						</form>
					{/if}
				</article>
			{:else}<p>{t('newsletter.empty')}</p>{/each}
		{/if}
	</main>
</DocShell>

<style>
	.newsletter-preview {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		padding: 24px 0;
	}
</style>
