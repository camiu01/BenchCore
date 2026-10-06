<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { PageData } from './$types';
	import DocShell from '../lib/components/DocShell.svelte';
	import Seo from '../lib/components/Seo.svelte';
	import { authenticationLink } from '../lib/navigation.js';
	import ReaderGate from '../lib/components/ReaderGate.svelte';
	import { publicationDate } from '../lib/presentation.js';

	let { data }: { data: PageData } = $props();

	const nav = $derived([
		{ href: '/posts', label: '[01] records' },
		{ href: '/tags', label: '[02] tags' },
		{ href: '/graph', label: '[03] graph' },
		...(data.sessionRole ? [{ href: '/account', label: '[04] account' }] : []),
		...(data.sessionRole === 'reader' ? [] : [authenticationLink(data.sessionRole, '05')]),
		...(data.sessionRole ? [] : [{ href: '/register', label: '[06] register' }])
	]);
</script>

<Seo title={data.title} description={data.description} canonical={data.siteBase} />

<DocShell
	docId="FORM: BENCHCORE-2026 // REF: PUB-LOG"
	title={data.title}
	sub={data.description}
	{nav}
	footerLeft="RELEASE: BETA // STATUS: ONLINE"
	footerRight="STACK: SVELTEKIT + TS"
	activeHref="/"
>
	<main id="records">
		<div class="btn-row browse-actions">
			<a class="btn btn-accent" href="/posts">Browse all posts</a>
			<a class="btn" href="/tags">Explore by topic</a>
		</div>
		{#if data.posts === null}
			<article class="record">
				<div class="record-header">
					<span class="record-title">Posts temporarily unavailable</span>
					<span class="stamp">PLEASE RETRY</span>
				</div>
				<p class="summary">We cannot load posts right now. Please try again in a moment.</p>
				<a class="btn" href="/">Try again</a>
			</article>
		{:else if data.posts.items.length === 0}
			<article class="record">
				<div class="record-header">
					<span class="record-title">No posts yet</span>
				</div>
				<p class="summary">New posts will appear here when they are published.</p>
				{#if data.sessionRole === 'admin'}<a class="btn" href="/admin/posts/new">Create a post</a
					>{/if}
			</article>
		{:else}
			{#each data.posts.items as post (post.id)}
				<article class="record">
					<div class="record-header">
						<span class="record-title">
							<a href="/posts/{encodeURIComponent(post.slug)}">{post.title}</a>
						</span>
						<span class="stamp">{post.audience === 'readers' ? 'READERS ONLY' : 'PUBLISHED'}</span>
					</div>
					{#if post.locked}<ReaderGate slug={post.slug} />{:else}<p class="summary">
							{post.description}
						</p>{/if}
					<table class="spec-table">
						<tbody>
							<tr>
								<td class="label">PUBLISHED</td>
								<td
									><time datetime={post.publishedAt ?? undefined}
										>{publicationDate(post.publishedAt)}</time
									></td
								>
							</tr>
							{#if post.tags.length > 0}
								<tr>
									<td class="label">TAGS</td>
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
									<td class="label">AUTHOR</td>
									<td>{post.authorName}</td>
								</tr>
							{/if}
						</tbody>
					</table>
				</article>
			{/each}
		{/if}
	</main>
</DocShell>
