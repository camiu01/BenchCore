<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { LayoutData, PageData } from './$types';
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import { adminPageHref, type AdminStatus } from '../../lib/admin-pagination.js';
	import { postStatusKeys } from '../../lib/admin-posts.js';
	import { currentLocale, t } from '../../lib/i18n/t.svelte.js';
	import type { MessageKey } from '../../lib/i18n/translate.js';
	import { publicationDate } from '../../lib/presentation.js';

	let { data }: { data: PageData & LayoutData } = $props();
	const filters = [
		{ value: 'all', key: 'admin.deck.filter.all' },
		{ value: 'draft', key: 'admin.deck.filter.draft' },
		{ value: 'published', key: 'admin.deck.filter.published' },
		{ value: 'archived', key: 'admin.deck.filter.archived' }
	] as const satisfies { value: AdminStatus; key: MessageKey }[];

	const nav = $derived([
		{ href: '/', label: `[01] ${t('admin.nav.index')}` },
		{ href: '/admin/posts/new', label: `[02] ${t('admin.nav.newRecord')}` },
		{ href: '/admin/tags', label: `[03] ${t('admin.nav.tags')}` },
		{ href: '/admin/comments', label: `[04] ${t('admin.nav.comments')}` },
		{ href: '/admin/users', label: `[05] ${t('admin.nav.users')}` },
		{ href: '/account', label: `[06] ${t('admin.nav.account')}` }
	]);
</script>

<Seo
	title={t('admin.deck.title')}
	description={t('admin.deck.description')}
	canonical="{data.siteBase}/admin"
/>

<DocShell
	docId="FORM: BENCHCORE-2026 // REF: ADMIN"
	title={t('admin.deck.heading')}
	sub={t('admin.deck.signedInAs', {
		email: data.user?.email ?? t('admin.deck.unknownUser'),
		role: data.user?.role ?? t('admin.deck.noRole')
	})}
	{nav}
	footerLeft={t('admin.deck.matchingPosts', { count: data.total })}
	footerRight={data.online ? t('admin.api.linked') : t('admin.api.offline')}
	activeHref="/admin"
	wide
>
	<main>
		<div class="workspace-heading">
			<div>
				<h2>{t('admin.deck.yourPosts')}</h2>
				<p class="summary">
					{t('admin.deck.summary')}
				</p>
			</div>
			<a class="btn btn-accent" href="/admin/posts/new">{t('admin.deck.newPost')}</a>
		</div>
		{#if !data.online}
			<article class="record">
				<div class="record-header">
					<span class="record-title">{t('admin.deck.unavailableTitle')}</span>
				</div>
				<p class="summary">{t('admin.deck.unavailableText')}</p>
				<a class="btn" href="/admin">{t('admin.deck.retry')}</a>
			</article>
		{:else if data.counts.all === 0 && !data.search}
			<article class="record">
				<div class="record-header">
					<span class="record-title">{t('admin.deck.firstPostTitle')}</span>
				</div>
				<p class="summary">
					{t('admin.deck.noRecords')}
					<a href="/admin/posts/new">{t('admin.deck.createFirst')}</a>.
				</p>
			</article>
		{:else}
			<section class="admin-post-tools" aria-label={t('admin.deck.searchAll')}>
				<form method="GET" action="/admin">
					<label class="field-label" for="admin-post-search">{t('admin.deck.findPost')}</label>
					<div class="btn-row">
						<input
							class="field-input"
							id="admin-post-search"
							name="search"
							type="search"
							value={data.search}
							maxlength="200"
							placeholder={t('admin.deck.searchPlaceholder')}
						/>
						<input type="hidden" name="status" value={data.status} />
						<button class="btn" type="submit">{t('admin.deck.search')}</button>
					</div>
				</form>
				<div class="status-filters" role="group" aria-label={t('admin.deck.postStatus')}>
					{#each filters as filter (filter.value)}
						<a
							class="btn"
							class:btn-accent={data.status === filter.value}
							aria-current={data.status === filter.value ? 'page' : undefined}
							href={adminPageHref(data.search, filter.value)}
						>
							{t(filter.key)}
							<span class="filter-count">{data.counts[filter.value]}</span>
						</a>
					{/each}
				</div>
			</section>
			<p class="field-help" role="status">
				{t('admin.deck.shown', { shown: data.items.length, total: data.total })}
			</p>
			<ul class="admin-post-list" aria-label={t('admin.deck.yourPosts')}>
				{#each data.items as post (post.id)}
					<li class="admin-post-card">
						<div>
							<a class="admin-post-title" href="/admin/posts/{post.id}">{post.title}</a>
							<p class="field-help">
								{t('admin.deck.updated', {
									slug: post.slug,
									date: publicationDate(post.updatedAt, currentLocale())
								})}
							</p>
							{#if post.tags.length}<p class="field-help">{post.tags.join(' · ')}</p>{/if}
						</div>
						<div class="admin-post-actions">
							<span class="stamp status-{post.status}">{t(postStatusKeys[post.status])}</span>
							<a
								class="btn"
								href="/admin/posts/{post.id}"
								aria-label={t('admin.deck.editPost', { title: post.title })}
								>{t('admin.deck.edit')}</a
							>
						</div>
					</li>
				{:else}
					<li class="record">
						<h3>{t('admin.deck.noMatchTitle')}</h3>
						<p class="summary">
							{t('admin.deck.noMatchText')}
						</p>
						<a class="btn" href="/admin">{t('admin.deck.clearFilters')}</a>
						<a class="btn" href={adminPageHref(data.search, data.status)}
							>{t('admin.deck.firstPage')}</a
						>
					</li>
				{/each}
			</ul>
			{#if data.totalPages > 1 || data.page > 1}
				<nav class="btn-row" aria-label={t('admin.deck.postPages')}>
					{#if data.page > 1}<a
							class="btn"
							rel="prev"
							href={adminPageHref(data.search, data.status, data.page - 1)}
							>{t('admin.deck.previous')}</a
						>{/if}
					<span class="field-help"
						>{t('admin.deck.pageOf', { page: data.page, total: data.totalPages })}</span
					>
					{#if data.page < data.totalPages}<a
							class="btn"
							rel="next"
							href={adminPageHref(data.search, data.status, data.page + 1)}
							>{t('admin.deck.next')}</a
						>{/if}
				</nav>
			{/if}
		{/if}
		<form method="POST" action="/logout" class="logout-form">
			<button class="btn" type="submit">{t('admin.deck.signOut')}</button>
		</form>
	</main>
</DocShell>
