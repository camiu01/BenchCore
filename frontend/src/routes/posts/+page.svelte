<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { PageData } from './$types';
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import { authenticationLink } from '../../lib/navigation.js';
	import ReaderGate from '../../lib/components/ReaderGate.svelte';
	import { publicationDate } from '../../lib/presentation.js';
	import { archiveHref, archiveSortLabel } from '../../lib/posts-query.js';
	import { currentLocale, t } from '../../lib/i18n/t.svelte.js';

	let { data }: { data: PageData } = $props();

	const nav = $derived([
		{ href: '/', label: `[01] ${t('public.nav.index')}` },
		{ href: '/tags', label: `[02] ${t('public.nav.tags')}` },
		{ href: '/graph', label: `[03] ${t('public.nav.graph')}` },
		authenticationLink(data.sessionRole, '04', currentLocale())
	]);
</script>

<Seo
	title={t('public.posts.seoTitle')}
	description={t('public.posts.seoDescription')}
	canonical="{data.siteBase}/posts"
/>

<DocShell
	docId={t('public.docId', { ref: 'RECORDS' })}
	title={t('public.posts.title')}
	sub={t('public.posts.sub', {
		total: data.total,
		sort: archiveSortLabel(data.sort, t)
	})}
	{nav}
	footerLeft={t('public.pageOf', { page: data.page, total: data.totalPages })}
	footerRight={t('public.posts.footerRight', { n: data.perPage })}
	activeHref="/posts"
>
	<main>
		<form method="GET" action="/posts" class="form-grid">
			<label class="field-label" for="search">{t('public.posts.searchLabel')}</label>
			<div class="search-row">
				<input
					class="field-input"
					id="search"
					name="search"
					type="search"
					maxlength="200"
					value={data.search}
					placeholder={t('public.posts.searchPlaceholder')}
				/>
				<button class="btn btn-accent" type="submit">{t('public.posts.searchButton')}</button>
			</div>
			<details class="filter-panel" open={data.tags.length > 0 || data.sort !== 'published'}>
				<summary>
					{t('public.posts.filters')}{#if data.tags.length > 0 || data.sort !== 'published'}
						<span class="stamp">{t('public.posts.active')}</span>{/if}
				</summary>
				<fieldset>
					<legend class="field-label">{t('public.posts.filterByTags')}</legend>
					<div class="archive-tags">
						{#each [...new Set( [...data.availableTags.map((tag) => tag.name), ...data.tags] )] as tag (tag)}
							<label
								><input type="checkbox" name="tag" value={tag} checked={data.tags.includes(tag)} />
								{tag}</label
							>
						{/each}
					</div>
					<p class="field-help">{t('public.posts.tagsHelp')}</p>
				</fieldset>
				<div class="field-row">
					<div>
						<label class="field-label" for="tag-mode">{t('public.posts.combineLabel')}</label>
						<select class="field-input" id="tag-mode" name="tagMode">
							<option value="and" selected={data.tagMode === 'and'}
								>{t('public.posts.combineAnd')}</option
							>
							<option value="or" selected={data.tagMode === 'or'}
								>{t('public.posts.combineOr')}</option
							>
						</select>
					</div>
					<div>
						<label class="field-label" for="sort">{t('public.posts.sortLabel')}</label>
						<select class="field-input" id="sort" name="sort">
							<option value="published" selected={data.sort === 'published'}
								>{t('public.posts.sortPublished')}</option
							>
							<option value="updated" selected={data.sort === 'updated'}
								>{t('public.posts.sortUpdated')}</option
							>
							<option value="popular" selected={data.sort === 'popular'}
								>{t('public.posts.sortPopular')}</option
							>
						</select>
					</div>
				</div>
				<p class="field-help">
					{t('public.posts.popularHelp')}
				</p>
			</details>
			<div class="btn-row">
				<button class="btn" type="submit">{t('public.posts.apply')}</button>
				{#if data.search || data.tags.length || data.sort !== 'published'}<a
						class="btn"
						href="/posts">{t('public.posts.clear')}</a
					>{/if}
			</div>
		</form>
		{#if !data.online}
			<article class="record">
				<div class="record-header">
					<span class="record-title">{t('public.postsUnavailable.title')}</span>
				</div>
				<p class="summary">{t('public.postsUnavailable.body')}</p>
				<a class="btn" href={archiveHref(data)}>{t('public.tryAgain')}</a>
			</article>
		{:else if data.items.length === 0}
			<article class="record">
				<div class="record-header">
					<span class="record-title"
						>{data.search ? t('public.posts.noMatches') : t('public.posts.noneOnPage')}</span
					>
				</div>
				<p class="summary">
					{data.search ? t('public.posts.noMatchesBody') : t('public.noPosts.body')}
				</p>
				{#if data.search || data.page > 1}<a class="btn" href="/posts"
						>{t('public.posts.showAll')}</a
					>{/if}
			</article>
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
							{#if data.sort === 'updated' && post.updatedAt}<tr
									><td class="label">{t('public.field.updated')}</td><td
										><time datetime={post.updatedAt}
											>{publicationDate(post.updatedAt, currentLocale())}</time
										></td
									></tr
								>{/if}
							{#if data.sort === 'popular' && !post.locked}<tr
									><td class="label">{t('public.field.likes')}</td><td>{post.likesCount}</td></tr
								>{/if}
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
		{#if data.totalPages > 1}
			<nav class="btn-row" aria-label={t('public.posts.pagesAria')}>
				<span class="page-position"
					>{t('public.pagePosition', { page: data.page, total: data.totalPages })}</span
				>
				{#if data.page > 1}
					<a class="btn" href={archiveHref(data, data.page - 1)}>{t('public.previous')}</a>
				{/if}
				{#if data.page < data.totalPages}
					<a class="btn" href={archiveHref(data, data.page + 1)}>{t('public.next')}</a>
				{/if}
			</nav>
		{/if}
	</main>
</DocShell>
