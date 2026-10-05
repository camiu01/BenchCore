<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { PageData } from './$types';
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';

	let { data }: { data: PageData } = $props();

	const nav = [
		{ href: '/', label: '[01] index' },
		{ href: '/tags', label: '[02] tags' },
		{ href: '/admin', label: '[03] admin' }
	];
</script>

<Seo
	title="Records | BenchCore"
	description="Every published record, newest first."
	canonical="{data.siteBase}/posts"
/>

<DocShell
	docId="FORM: BENCHCORE-2026 // REF: RECORDS"
	title="RECORDS"
	sub="Every published record, newest first. {data.total} filed."
	{nav}
	footerLeft="PAGE {data.page} OF {data.totalPages}"
	footerRight="PER PAGE: {data.perPage}"
>
	<main>
		<form method="GET" action="/posts" class="form-grid">
			<label class="field-label" for="search">Search records</label>
			<input
				class="field-input"
				id="search"
				name="search"
				type="search"
				maxlength="200"
				value={data.search}
			/>
			<div class="btn-row">
				<button class="btn" type="submit">SEARCH</button>
				{#if data.search}<a class="btn" href="/posts">CLEAR</a>{/if}
			</div>
		</form>
		{#if !data.online}
			<article class="record">
				<div class="record-header">
					<span class="record-title">UPLINK // NO CARRIER</span>
					<span class="stamp">API OFFLINE</span>
				</div>
				<p class="summary">Start the API with <code>pnpm dev:api</code>.</p>
			</article>
		{:else if data.items.length === 0}
			<article class="record">
				<div class="record-header">
					<span class="record-title">ARCHIVE // EMPTY</span>
					<span class="stamp">NO RECORDS</span>
				</div>
				<p class="summary">Nothing filed on this page.</p>
			</article>
		{:else}
			{#each data.items as post (post.id)}
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
						</tbody>
					</table>
				</article>
			{/each}
		{/if}
		{#if data.totalPages > 1}
			<div class="btn-row">
				{#if data.page > 1}
					<a class="btn" href="/posts?page={data.page - 1}&search={encodeURIComponent(data.search)}"
						>← PREV</a
					>
				{/if}
				{#if data.page < data.totalPages}
					<a class="btn" href="/posts?page={data.page + 1}&search={encodeURIComponent(data.search)}"
						>NEXT →</a
					>
				{/if}
			</div>
		{/if}
	</main>
</DocShell>
