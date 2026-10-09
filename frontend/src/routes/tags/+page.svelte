<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { PageData } from './$types';
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import TagChip from '../../lib/components/TagChip.svelte';
	import { authenticationLink } from '../../lib/navigation.js';
	import { currentLocale, t } from '../../lib/i18n/t.svelte.js';

	let { data }: { data: PageData } = $props();

	const nav = $derived([
		{ href: '/', label: `[01] ${t('public.nav.index')}` },
		{ href: '/posts', label: `[02] ${t('public.nav.records')}` },
		{ href: '/graph', label: `[03] ${t('public.nav.graph')}` },
		authenticationLink(data.sessionRole, '04', currentLocale())
	]);
</script>

<Seo
	title={t('public.tags.seoTitle')}
	description={t('public.tags.seoDescription')}
	canonical="{data.siteBase}/tags"
/>

<DocShell
	docId={t('public.docId', { ref: 'TAGS' })}
	title={t('public.tags.title')}
	sub={t('public.tags.sub')}
	{nav}
	footerLeft={t('public.tags.footerLeft', { n: data.items.length })}
	footerRight={t('public.tags.footerRight')}
	activeHref="/tags"
>
	<main>
		{#if !data.online}
			<article class="record">
				<div class="record-header">
					<span class="record-title">{t('public.tags.unavailable')}</span>
				</div>
				<p class="summary">{t('public.tags.unavailableBody')}</p>
				<a class="btn" href="/tags">{t('public.tryAgain')}</a>
			</article>
		{:else if data.items.length === 0}
			<p class="summary">{t('public.tags.empty')}</p>
			<a class="btn" href="/posts">{t('public.browsePosts')}</a>
		{:else}
			<ul class="topic-grid" aria-label={t('public.tags.listAria')}>
				{#each data.items as tag (tag.slug)}
					<li>
						<a class="topic-card" href="/tags/{encodeURIComponent(tag.name)}">
							<TagChip label={tag.name} color={tag.color} />
							<span class="topic-count"
								>{t(tag.count === 1 ? 'public.tags.countOne' : 'public.tags.countMany', {
									n: tag.count
								})}</span
							>
							<span class="topic-open">{t('public.tags.explore')}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</main>
</DocShell>
