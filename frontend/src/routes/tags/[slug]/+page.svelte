<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import ReaderGate from '../../../lib/components/ReaderGate.svelte';
	import type { PageData } from './$types';
	import DocShell from '../../../lib/components/DocShell.svelte';
	import Seo from '../../../lib/components/Seo.svelte';
	import { t } from '../../../lib/i18n/t.svelte.js';

	let { data }: { data: PageData } = $props();

	const nav = $derived([
		{ href: '/', label: `[01] ${t('public.nav.index')}` },
		{ href: '/posts', label: `[02] ${t('public.nav.records')}` },
		{ href: '/tags', label: `[03] ${t('public.nav.tags')}` }
	]);
</script>

<Seo
	title={t('public.tag.seoTitle', { tag: data.tag })}
	description={t('public.tag.seoDescription', { tag: data.tag })}
	canonical="{data.siteBase}/tags/{encodeURIComponent(data.tag)}"
/>

<DocShell
	docId={t('public.docId', { ref: `TAG-${data.tag.toUpperCase()}` })}
	title={t('public.tag.title', { tag: data.tag })}
	sub={t('public.tag.sub', { total: data.total })}
	{nav}
	footerLeft={t('public.pageOf', { page: data.page, total: data.totalPages })}
	footerRight={t('public.tag.footerRight')}
	activeHref="/tags"
>
	<main>
		<p><a href="/tags">{t('public.tag.allTopics')}</a></p>
		{#if !data.online}
			<article class="record">
				<div class="record-header">
					<span class="record-title">{t('public.postsUnavailable.title')}</span>
				</div>
				<p class="summary">{t('public.postsUnavailable.body')}</p>
				<a class="btn" href="/tags/{encodeURIComponent(data.tag)}">{t('public.tryAgain')}</a>
			</article>
		{:else if data.items.length === 0}
			<p class="summary">
				{t('public.tag.noneOnPage')}
			</p>
			<a class="btn" href="/posts">{t('public.browsePosts')}</a>
		{:else}
			{#each data.items as post (post.id)}
				<article class="record">
					<div class="record-header">
						<span class="record-title">
							<a href="/posts/{encodeURIComponent(post.slug)}">{post.title}</a>
						</span>
						<span class="stamp"
							>{post.audience === 'readers' ? t('public.readersOnly') : t('public.published')}</span
						>
					</div>
					{#if post.locked}<ReaderGate slug={post.slug} />{:else}<p class="summary">
							{post.description}
						</p>{/if}
				</article>
			{/each}
		{/if}
		{#if data.totalPages > 1}
			<nav class="btn-row" aria-label={t('public.tag.pagesAria')}>
				<span class="page-position"
					>{t('public.pagePosition', { page: data.page, total: data.totalPages })}</span
				>
				{#if data.page > 1}
					<a class="btn" href="/tags/{encodeURIComponent(data.tag)}?page={data.page - 1}"
						>{t('public.previous')}</a
					>
				{/if}
				{#if data.page < data.totalPages}
					<a class="btn" href="/tags/{encodeURIComponent(data.tag)}?page={data.page + 1}"
						>{t('public.next')}</a
					>
				{/if}
			</nav>
		{/if}
	</main>
</DocShell>
