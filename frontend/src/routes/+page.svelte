<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { PageData } from './$types';
	import DocShell from '../lib/components/DocShell.svelte';
	import Seo from '../lib/components/Seo.svelte';
	import { authenticationLink } from '../lib/navigation.js';
	import ReaderGate from '../lib/components/ReaderGate.svelte';
	import { publicationDate } from '../lib/presentation.js';
	import { currentLocale, t } from '../lib/i18n/t.svelte.js';

	let { data }: { data: PageData } = $props();

	const nav = $derived([
		{ href: '/posts', label: `[01] ${t('public.nav.records')}` },
		{ href: '/tags', label: `[02] ${t('public.nav.tags')}` },
		{ href: '/graph', label: `[03] ${t('public.nav.graph')}` },
		...(data.sessionRole ? [{ href: '/account', label: `[04] ${t('public.nav.account')}` }] : []),
		...(data.sessionRole === 'reader'
			? []
			: [authenticationLink(data.sessionRole, '05', currentLocale())]),
		...(data.sessionRole ? [] : [{ href: '/register', label: `[06] ${t('public.nav.register')}` }])
	]);
</script>

<Seo title={data.title} description={data.description} canonical={data.siteBase} />

<DocShell
	docId={t('public.docId', { ref: 'PUB-LOG' })}
	title={data.title}
	sub={data.description}
	{nav}
	footerLeft={t('public.home.footerLeft')}
	footerRight={t('public.home.footerRight')}
	activeHref="/"
>
	<main id="records">
		<div class="btn-row browse-actions">
			<a class="btn btn-accent" href="/posts">{t('public.home.browseAll')}</a>
			<a class="btn" href="/tags">{t('public.home.exploreTopics')}</a>
		</div>
		{#if data.posts === null}
			<article class="record">
				<div class="record-header">
					<span class="record-title">{t('public.postsUnavailable.title')}</span>
					<span class="stamp">{t('public.home.retryStamp')}</span>
				</div>
				<p class="summary">{t('public.postsUnavailable.body')}</p>
				<a class="btn" href="/">{t('public.tryAgain')}</a>
			</article>
		{:else if data.posts.items.length === 0}
			<article class="record">
				<div class="record-header">
					<span class="record-title">{t('public.home.noPosts')}</span>
				</div>
				<p class="summary">{t('public.noPosts.body')}</p>
				{#if data.sessionRole === 'admin'}<a class="btn" href="/admin/posts/new"
						>{t('public.home.createPost')}</a
					>{/if}
			</article>
		{:else}
			{#each data.posts.items as post (post.id)}
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
					<table class="spec-table">
						<tbody>
							<tr>
								<td class="label">{t('public.published')}</td>
								<td
									><time datetime={post.publishedAt ?? undefined}
										>{publicationDate(post.publishedAt, currentLocale())}</time
									></td
								>
							</tr>
							{#if post.tags.length > 0}
								<tr>
									<td class="label">{t('public.field.tags')}</td>
									<td>
										{#each post.tags as tag, index (tag)}<a href="/tags/{encodeURIComponent(tag)}"
												>{tag}</a
											>{#if index < post.tags.length - 1},
											{/if}{/each}
									</td>
								</tr>
							{/if}
							{#if post.authorName !== null}
								<tr>
									<td class="label">{t('public.field.author')}</td>
									<td>{post.authorName}</td>
								</tr>
							{/if}
						</tbody>
					</table>
					<div class="card-actions">
						<a
							class="btn"
							href="/posts/{encodeURIComponent(post.slug)}"
							aria-label={t('public.readAria', { title: post.title })}>{t('public.read')}</a
						>
					</div>
				</article>
			{/each}
		{/if}
	</main>
</DocShell>
