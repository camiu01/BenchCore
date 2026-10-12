<!-- @file InformationPage.svelte @brief Shared engineering-log layout for localized public information. -->
<script lang="ts">
	import DocShell from './DocShell.svelte';
	import Seo from './Seo.svelte';
	import type { InformationPage } from '../info-pages.js';
	import { authenticationLink } from '../navigation.js';
	import { currentLocale, t } from '../i18n/t.svelte.js';

	interface Props {
		content: InformationPage;
		siteBase: string;
		sessionRole: string | null;
	}
	let { content, siteBase, sessionRole }: Props = $props();
	const nav = $derived([
		{ href: '/', label: `[01] ${t('public.nav.index')}` },
		{ href: '/posts', label: `[02] ${t('public.nav.records')}` },
		{ href: '/tags', label: `[03] ${t('public.nav.tags')}` },
		{ href: '/graph', label: `[04] ${t('public.nav.graph')}` },
		authenticationLink(sessionRole, '05', currentLocale())
	]);
</script>

<Seo
	title="{t(content.title)} | BenchCore"
	description={t(content.description)}
	canonical="{siteBase}{content.path}"
	type="website"
/>
<DocShell
	docId={t('public.docId', { ref: content.ref })}
	title={t(content.title)}
	sub={t(content.intro)}
	{nav}
	activeHref={content.path}
	footerLeft="BENCHCORE"
	footerRight={content.ref}
>
	<main class="information-page">
		{#each content.sections as section, index (section.heading)}
			<section class="record" aria-labelledby="info-section-{index}">
				<div class="record-header">
					<h2 class="record-title" id="info-section-{index}">{t(section.heading)}</h2>
				</div>
				{#each section.paragraphs as paragraph (paragraph)}
					<p class="summary">{t(paragraph)}</p>
				{/each}
				{#if section.links}
					<div class="information-links">
						{#each section.links as link (link.href)}
							<a class="btn" href={link.href}>{t(link.label)}</a>
						{/each}
					</div>
				{/if}
			</section>
		{/each}
	</main>
</DocShell>

<style>
	.record-title {
		margin: 0;
		font-size: inherit;
	}
	.summary {
		max-width: 72ch;
	}
	.information-links {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 16px;
	}
</style>
