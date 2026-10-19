<!-- @file +page.svelte @brief Email consent confirmation without account or GET-side effects. -->
<script lang="ts">
	import DocShell from '../../../lib/components/DocShell.svelte';
	import Seo from '../../../lib/components/Seo.svelte';
	import { t } from '../../../lib/i18n/t.svelte.js';
	import type { PageData, ActionData } from './$types';
	let { data, form }: { data: PageData; form?: ActionData } = $props();
	const nav = $derived([{ href: '/newsletter', label: t('newsletter.title') }]);
	const confirming = $derived(data.action === 'confirm');
</script>

<Seo
	title={t(confirming ? 'newsletter.confirmTitle' : 'newsletter.unsubscribeTitle')}
	description={t('newsletter.noAccount')}
	type="website"
	noindex
/>

<DocShell
	title={t(confirming ? 'newsletter.confirmTitle' : 'newsletter.unsubscribeTitle')}
	sub={t('newsletter.noAccount')}
	{nav}
	docId="FORM: CONSENT"
	footerLeft="BenchCore"
	footerRight="Newsletter"
>
	<main>
		<article class="record">
			{#if form?.accepted}
				<p role="status">{t(confirming ? 'newsletter.confirmed' : 'newsletter.unsubscribed')}</p>
			{:else if !data.token || form?.accepted === false}
				<p role="alert">{t('newsletter.invalidToken')}</p>
			{:else}
				<p>{t(confirming ? 'newsletter.confirmHelp' : 'newsletter.unsubscribeHelp')}</p>
				<form method="POST">
					<input type="hidden" name="token" value={data.token} />
					<button class="btn btn-accent" type="submit"
						>{t(confirming ? 'newsletter.confirmTitle' : 'newsletter.unsubscribeTitle')}</button
					>
				</form>
			{/if}
		</article>
	</main>
</DocShell>
