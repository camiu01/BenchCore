<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { PageData } from './$types';
	import DocShell from '../../../lib/components/DocShell.svelte';
	import Seo from '../../../lib/components/Seo.svelte';
	import PostEngagement from '../../../lib/components/PostEngagement.svelte';
	import ReaderGate from '../../../lib/components/ReaderGate.svelte';
	import { publicationDate } from '../../../lib/presentation.js';
	import { currentLocale, t } from '../../../lib/i18n/t.svelte.js';
	import { postOutline } from '../../../lib/post-outline.js';
	import PostOutline from '../../../lib/components/PostOutline.svelte';
	import { onDestroy } from 'svelte';
	import {
		createPreviewController,
		linkedPostPreviews,
		type PreviewTarget
	} from '../../../lib/linked-previews.js';
	import PostPreviewCard from '../../../lib/components/PostPreviewCard.svelte';

	let { data }: { data: PageData } = $props();
	let previewTarget = $state<PreviewTarget | null>(null);
	const previews = createPreviewController((target) => {
		previewTarget = target;
	});
	onDestroy(() => previews.destroy());

	const nav = $derived([
		{ href: '/', label: `[01] ${t('public.nav.index')}` },
		{ href: '/posts', label: `[02] ${t('public.nav.records')}` },
		{ href: '/tags', label: `[03] ${t('public.nav.tags')}` },
		{
			href: `/graph?focus=${encodeURIComponent(data.post.slug)}`,
			label: `[04] ${t('public.nav.graph')}`
		}
	]);
	const cover = $derived(data.cover);
	const canonical = $derived(`${data.siteBase}/posts/${encodeURIComponent(data.post.slug)}`);
	const outline = $derived(postOutline(data.post.locked ? '' : data.post.contentHtml, t));
</script>

<Seo
	title="{data.post.title} | BenchCore"
	description={data.post.description || data.post.title}
	{canonical}
	image={data.coverAbsolute}
/>

<DocShell
	docId={t('public.docId', { ref: data.post.slug.toUpperCase() })}
	title={data.post.title}
	sub={data.post.locked ? t('public.post.signInToRead') : data.post.description || ''}
	{nav}
	footerLeft={data.post.locked
		? t('public.post.footerLocked')
		: t('public.post.footerRead', { n: data.post.readingMinutes })}
	footerRight={t('public.post.footerPublished', {
		date: publicationDate(data.post.publishedAt, currentLocale())
	})}
	activeHref="/posts"
>
	<main>
		<nav class="breadcrumb" aria-label={t('public.post.breadcrumb')}>
			<a href="/">{t('public.post.breadcrumbIndex')}</a><span aria-hidden="true">/</span><a
				href="/posts">{t('public.post.breadcrumbPosts')}</a
			><span aria-hidden="true">/</span><span aria-current="page">{data.post.slug}</span>
		</nav>
		<article class="record">
			<div class="record-header">
				<span class="record-title">{t('public.post.record', { slug: data.post.slug })}</span>
				<span class="stamp"
					>{data.post.audience === 'readers'
						? t('public.readersOnly')
						: t('public.published')}</span
				>
			</div>
			<table class="spec-table">
				<tbody>
					<tr>
						<td class="label">{t('public.published')}</td>
						<td
							><time datetime={data.post.publishedAt ?? undefined}
								>{publicationDate(data.post.publishedAt, currentLocale())}</time
							></td
						>
					</tr>
					{#if data.post.authorName !== null}
						<tr>
							<td class="label">{t('public.field.author')}</td>
							<td>{data.post.authorName}</td>
						</tr>
					{/if}
					{#if data.post.tags.length > 0}
						<tr>
							<td class="label">{t('public.field.tags')}</td>
							<td>
								{#each data.post.tags as tag, index (tag)}<a href="/tags/{encodeURIComponent(tag)}"
										>{tag}</a
									>{#if index < data.post.tags.length - 1},
									{/if}{/each}
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
			{#if data.post.locked}
				<ReaderGate slug={data.post.slug} />
			{:else}
				{#if cover !== null}
					<figure class="cover-figure">
						<img src={cover} alt={data.post.title} class="cover-image" />
					</figure>
				{/if}
				<PostOutline headings={outline.headings} />
				<!-- contentHtml is sanitized by the API render pipeline before storage. -->
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="record-body" use:linkedPostPreviews={previews}>{@html outline.html}</div>
			{/if}
		</article>

		{#if data.post.backlinks.length > 0}
			<section class="tool-section">
				<div class="section-banner">{t('public.post.backlinks')}</div>
				<table class="inventory-table">
					<thead>
						<tr>
							<th>{t('public.post.colRef')}</th>
							<th>{t('public.post.colRecord')}</th>
							<th>{t('public.post.colLink')}</th>
						</tr>
					</thead>
					<tbody>
						{#each data.post.backlinks as link, index (link.slug)}
							<tr>
								<td class="code">BK-{String(index + 1).padStart(2, '0')}</td>
								<td class="item">{link.title}</td>
								<td class="dim"
									><a
										href="/posts/{encodeURIComponent(link.slug)}"
										aria-label={t('public.readAria', { title: link.title })}>{t('public.read')}</a
									></td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}
		{#if !data.post.locked}{#key data.post.slug}
				<PostEngagement slug={data.post.slug} />
			{/key}{/if}
	</main>
</DocShell>
{#if previewTarget}<PostPreviewCard target={previewTarget} controller={previews} />{/if}
