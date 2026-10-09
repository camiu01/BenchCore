<!-- @file +page.svelte @brief Plain-language list of everything BenchCore stores in the browser. -->
<script lang="ts">
	import type { PageData } from './$types';
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import { authenticationLink } from '../../lib/navigation.js';
	import { currentLocale, t } from '../../lib/i18n/t.svelte.js';

	let { data }: { data: PageData } = $props();

	const nav = $derived([
		{ href: '/', label: `[01] ${t('public.nav.index')}` },
		{ href: '/posts', label: `[02] ${t('public.nav.records')}` },
		{ href: '/tags', label: `[03] ${t('public.nav.tags')}` },
		authenticationLink(data.sessionRole, '04', currentLocale())
	]);

	const items = $derived([
		{
			code: t('public.cookies.typeCookie'),
			name: 'session',
			purpose: t('public.cookies.sessionPurpose'),
			duration: t('public.cookies.sessionLasts')
		},
		{
			code: t('public.cookies.typeCookie'),
			name: 'lang',
			purpose: t('public.cookies.langPurpose'),
			duration: t('public.cookies.langLasts')
		},
		{
			code: t('public.cookies.typeLocal'),
			name: 'site-theme',
			purpose: t('public.cookies.themePurpose'),
			duration: t('public.cookies.untilCleared')
		},
		{
			code: t('public.cookies.typeLocal'),
			name: 'cookie-notice',
			purpose: t('public.cookies.noticePurpose'),
			duration: t('public.cookies.untilCleared')
		}
	]);
</script>

<Seo
	title={t('public.cookies.seoTitle')}
	description={t('public.cookies.seoDescription')}
	canonical="{data.siteBase}/cookies"
/>

<DocShell
	docId={t('public.docId', { ref: 'COOKIES' })}
	title={t('public.cookies.title')}
	sub={t('public.cookies.sub')}
	{nav}
	footerLeft={t('public.cookies.footerLeft')}
	footerRight={t('public.cookies.footerRight')}
	activeHref="/cookies"
>
	<main>
		<article class="record">
			<div class="record-header">
				<span class="record-title">{t('public.cookies.whatTitle')}</span>
				<span class="stamp">{t('public.cookies.stamp')}</span>
			</div>
			<p class="summary">{t('public.cookies.intro')}</p>
			<table class="inventory-table">
				<thead>
					<tr>
						<th>{t('public.cookies.colType')}</th>
						<th>{t('public.cookies.colName')}</th>
						<th>{t('public.cookies.colPurpose')}</th>
						<th>{t('public.cookies.colLasts')}</th>
					</tr>
				</thead>
				<tbody>
					{#each items as item (item.name)}
						<tr>
							<td class="code">{item.code}</td>
							<td class="item"><code>{item.name}</code></td>
							<td>{item.purpose}</td>
							<td class="dim">{item.duration}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</article>
		<article class="record">
			<div class="record-header">
				<span class="record-title">{t('public.cookies.controlTitle')}</span>
			</div>
			<p class="summary">{t('public.cookies.control')}</p>
			<a class="btn" href="/">{t('public.cookies.back')}</a>
		</article>
	</main>
</DocShell>
