<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { LayoutData, PageData } from './$types';
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import { adminPageHref, type AdminStatus } from '../../lib/admin-pagination.js';
	import { publicationDate } from '../../lib/presentation.js';

	let { data }: { data: PageData & LayoutData } = $props();
	const filters: { value: AdminStatus; label: string }[] = [
		{ value: 'all', label: 'All posts' },
		{ value: 'draft', label: 'Drafts' },
		{ value: 'published', label: 'Published' },
		{ value: 'archived', label: 'Archived' }
	];

	const nav = [
		{ href: '/', label: '[01] index' },
		{ href: '/admin/posts/new', label: '[02] new record' },
		{ href: '/admin/tags', label: '[03] tags' },
		{ href: '/admin/comments', label: '[04] comments' },
		{ href: '/admin/users', label: '[05] users' },
		{ href: '/account', label: '[06] account' }
	];
</script>

<Seo
	title="Admin | BenchCore"
	description="Operator dashboard."
	canonical="{data.siteBase}/admin"
/>

<DocShell
	docId="FORM: BENCHCORE-2026 // REF: ADMIN"
	title="ADMINISTRATION"
	sub="Signed in as {data.user?.email ?? 'unknown'} ({data.user?.role ?? 'none'})."
	{nav}
	footerLeft="MATCHING POSTS: {data.total}"
	footerRight={data.online ? 'API: LINKED' : 'API: OFFLINE'}
	activeHref="/admin"
	wide
>
	<main>
		<div class="workspace-heading">
			<div>
				<h2>Your posts</h2>
				<p class="summary">
					Manage drafts, review published posts and keep your archive organized.
				</p>
			</div>
			<a class="btn btn-accent" href="/admin/posts/new">+ New post</a>
		</div>
		{#if !data.online}
			<article class="record">
				<div class="record-header">
					<span class="record-title">Posts temporarily unavailable</span>
				</div>
				<p class="summary">We cannot load posts right now. Please try again in a moment.</p>
				<a class="btn" href="/admin">Try again</a>
			</article>
		{:else if data.counts.all === 0 && !data.search}
			<article class="record">
				<div class="record-header"><span class="record-title">Write your first post</span></div>
				<p class="summary">
					No records yet. <a href="/admin/posts/new">Create the first record</a>.
				</p>
			</article>
		{:else}
			<section class="admin-post-tools" aria-label="Search all posts">
				<form method="GET" action="/admin">
					<label class="field-label" for="admin-post-search">Find a post</label>
					<div class="btn-row">
						<input
							class="field-input"
							id="admin-post-search"
							name="search"
							type="search"
							value={data.search}
							maxlength="200"
							placeholder="Search by title or slug"
						/>
						<input type="hidden" name="status" value={data.status} />
						<button class="btn" type="submit">Search</button>
					</div>
				</form>
				<div class="status-filters" role="group" aria-label="Post status">
					{#each filters as filter (filter.value)}
						<a
							class="btn"
							class:btn-accent={data.status === filter.value}
							aria-current={data.status === filter.value ? 'page' : undefined}
							href={adminPageHref(data.search, filter.value)}
						>
							{filter.label}
							<span class="filter-count">{data.counts[filter.value]}</span>
						</a>
					{/each}
				</div>
			</section>
			<p class="field-help" role="status">
				{data.items.length} of {data.total} matching posts shown. Search covers the entire archive.
			</p>
			<ul class="admin-post-list" aria-label="Your posts">
				{#each data.items as post (post.id)}
					<li class="admin-post-card">
						<div>
							<a class="admin-post-title" href="/admin/posts/{post.id}">{post.title}</a>
							<p class="field-help">/{post.slug} · Updated {publicationDate(post.updatedAt)}</p>
							{#if post.tags.length}<p class="field-help">{post.tags.join(' · ')}</p>{/if}
						</div>
						<div class="admin-post-actions">
							<span class="stamp status-{post.status}">{post.status}</span>
							<a class="btn" href="/admin/posts/{post.id}" aria-label="Edit {post.title}">Edit →</a>
						</div>
					</li>
				{:else}
					<li class="record">
						<h3>No matching posts</h3>
						<p class="summary">
							Try another title or slug, clear the filters or return to page one.
						</p>
						<a class="btn" href="/admin">Clear filters</a>
						<a class="btn" href={adminPageHref(data.search, data.status)}>First page</a>
					</li>
				{/each}
			</ul>
			{#if data.totalPages > 1 || data.page > 1}
				<nav class="btn-row" aria-label="Post pages">
					{#if data.page > 1}<a
							class="btn"
							rel="prev"
							href={adminPageHref(data.search, data.status, data.page - 1)}>Previous</a
						>{/if}
					<span class="field-help">Page {data.page} of {data.totalPages}</span>
					{#if data.page < data.totalPages}<a
							class="btn"
							rel="next"
							href={adminPageHref(data.search, data.status, data.page + 1)}>Next</a
						>{/if}
				</nav>
			{/if}
		{/if}
		<form method="POST" action="/logout" class="logout-form">
			<button class="btn" type="submit">SIGN OUT</button>
		</form>
	</main>
</DocShell>
