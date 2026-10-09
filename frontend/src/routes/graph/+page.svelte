<!-- @file +page.svelte @brief Public explorer for shared topics and post links. -->
<script lang="ts">
	import DocShell from '../../lib/components/DocShell.svelte';
	import GraphView from '../../lib/components/GraphView.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import type { PageData } from './$types';
	import { authenticationLink } from '../../lib/navigation.js';
	import { currentLocale, t } from '../../lib/i18n/t.svelte.js';

	let { data }: { data: PageData } = $props();
	const nav = $derived([
		{ href: '/', label: `[01] ${t('public.nav.index')}` },
		{ href: '/posts', label: `[02] ${t('public.nav.records')}` },
		{ href: '/tags', label: `[03] ${t('public.nav.tags')}` },
		authenticationLink(data.sessionRole, '04', currentLocale())
	]);
</script>

<Seo
	title={t('public.graph.seoTitle')}
	description={t('public.graph.seoDescription')}
	canonical="{data.siteBase}/graph"
/>

<DocShell
	docId={t('public.docId', { ref: 'GRAPH' })}
	title={t('public.graph.title')}
	sub={t('public.graph.sub', {
		posts: data.graph.nodes.length,
		links: data.graph.edges.length
	})}
	{nav}
	footerLeft={data.online ? t('public.graph.footerLinked') : t('public.graph.footerOffline')}
	footerRight={t('public.graph.footerRight')}
	wide
	activeHref="/graph"
>
	<main>
		{#if !data.online}
			<p class="error-stamp" role="alert">
				{t('public.graph.unavailable')}
			</p>
			<a class="btn" href="/graph">{t('public.tryAgain')}</a>
		{:else if data.graph.nodes.length === 0}
			<article class="record">
				<div class="record-header">
					<span class="record-title">{t('public.graph.emptyTitle')}</span>
				</div>
				<p class="summary">{t('public.graph.emptyBody')}</p>
				<a class="btn" href="/posts">{t('public.browsePosts')}</a>
			</article>
		{:else}
			{#key data.graph}
				<GraphView graph={data.graph} focus={data.focus} />
			{/key}
		{/if}
	</main>
</DocShell>
