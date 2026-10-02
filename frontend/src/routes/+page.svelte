<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { PageData } from './$types';
	import DocShell from '../lib/components/DocShell.svelte';
	import Seo from '../lib/components/Seo.svelte';

	let { data }: { data: PageData } = $props();

	const nav = [
		{ href: '/posts', label: '[01] records' },
		{ href: '/tags', label: '[02] tags' },
		{ href: '/account', label: '[03] account' },
		{ href: '/admin', label: '[04] admin' },
		{ href: '/register', label: '[05] register' }
	];
</script>

<Seo title={data.title} description={data.description} canonical={data.siteBase} />

<DocShell
	docId="FORM: BENCHCORE-2026 // REF: PUB-LOG"
	title={data.title}
	sub={data.description}
	{nav}
	footerLeft="RELEASE: BETA // STATUS: ONLINE"
	footerRight="STACK: SVELTEKIT + TS"
>
	<main id="records">
		{#if data.posts === null}
			<article class="record">
				<div class="record-header">
					<span class="record-title">REC_00: UPLINK // NO CARRIER</span>
					<span class="stamp">API OFFLINE</span>
				</div>
				<p class="summary">
					The API is unreachable. Start it with <code>pnpm dev:api</code> and reload this sheet.
				</p>
			</article>
		{:else if data.posts.items.length === 0}
			<article class="record">
				<div class="record-header">
					<span class="record-title">REC_00: ARCHIVE // EMPTY</span>
					<span class="stamp">NO RECORDS</span>
				</div>
				<p class="summary">
					No published posts yet. Create a record in <a href="/admin">the operator deck</a>, or
					import authored files with <code>pnpm content:import</code>.
				</p>
			</article>
		{:else}
			{#each data.posts.items as post (post.id)}
				<article class="record">
					<div class="record-header">
						<span class="record-title">
							<a href="/posts/{encodeURIComponent(post.slug)}">{post.title}</a>
						</span>
						<span class="stamp">PUBLISHED</span>
					</div>
					<p class="summary">{post.description}</p>
					<table class="spec-table">
						<tbody>
							<tr>
								<td class="label">FILED</td>
								<td>{post.publishedAt ?? 'undated'}</td>
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
