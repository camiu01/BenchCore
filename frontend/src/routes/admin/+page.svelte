<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { LayoutData, PageData } from './$types';
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import { adminPostCounts, filterAdminPosts } from '../../lib/admin-posts.js';
	import { publicationDate } from '../../lib/presentation.js';

	let { data }: { data: PageData & LayoutData } = $props();
	let query = $state('');
	let status = $state('all');
	const posts = $derived(filterAdminPosts(data.items, query, status));
	const counts = $derived(adminPostCounts(data.items));
	const filters: { value: keyof ReturnType<typeof adminPostCounts>; label: string }[] = [
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
	footerLeft="RECORDS: {data.total}"
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
		{:else if data.items.length === 0}
			<article class="record">
				<div class="record-header"><span class="record-title">Write your first post</span></div>
				<p class="summary">
					No records yet. <a href="/admin/posts/new">Create the first record</a>.
				</p>
			</article>
		{:else}
			<section class="admin-post-tools" aria-label="Filter loaded posts">
				<label class="field-label" for="admin-post-search">Find a post</label>
				<input
					class="field-input"
					id="admin-post-search"
					type="search"
					bind:value={query}
					placeholder="Search by title or slug"
				/>
				<div class="status-filters" role="group" aria-label="Post status">
					{#each filters as filter (filter.value)}
						<button
							class="btn"
							class:btn-accent={status === filter.value}
							type="button"
							aria-pressed={status === filter.value}
							onclick={() => {
								status = filter.value;
							}}
						>
							{filter.label}
							<span class="filter-count">{counts[filter.value]}</span>
						</button>
					{/each}
				</div>
			</section>
			<p class="field-help" role="status">
				{posts.length} of {data.items.length} loaded posts shown.
			</p>
			{#if data.total > data.items.length}
				<p class="field-help">
					Filters apply to the loaded page, not all {data.total} posts in the archive.
				</p>
			{/if}
			<ul class="admin-post-list" aria-label="Your posts">
				{#each posts as post (post.id)}
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
						<p class="summary">Try another title or slug, or show all loaded posts.</p>
						<button
							class="btn"
							type="button"
							onclick={() => {
								query = '';
								status = 'all';
							}}>Clear filters</button
						>
					</li>
				{/each}
			</ul>
		{/if}
		<form method="POST" action="/logout" class="logout-form">
			<button class="btn" type="submit">SIGN OUT</button>
		</form>
	</main>
</DocShell>
