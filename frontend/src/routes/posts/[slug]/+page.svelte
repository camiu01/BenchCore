<script lang="ts">
	import type { PageData } from './$types';
	import DocShell from '../../../lib/components/DocShell.svelte';
	import Seo from '../../../lib/components/Seo.svelte';
	import { resolveMediaUrl } from '../../../lib/api.js';
	import { siteBase } from '../../../lib/site.js';

	let { data }: { data: PageData } = $props();

	const nav = [
		{ href: '/', label: '[01] index' },
		{ href: '/posts', label: '[02] records' },
		{ href: '/tags', label: '[03] tags' }
	];
	const cover = $derived(resolveMediaUrl(data.post.coverImage));
	const canonical = $derived(`${siteBase()}/posts/${data.post.slug}`);
</script>

<Seo
	title="{data.post.title} — Engineering Log"
	description={data.post.description || data.post.title}
	{canonical}
	image={cover}
/>

<DocShell
	docId="FORM: BLOG-2026 // REF: {data.post.slug.toUpperCase()}"
	title={data.post.title}
	sub={data.post.description || 'No summary filed.'}
	{nav}
	footerLeft="READ: {data.post.readingMinutes} MIN"
	footerRight="FILED: {data.post.publishedAt ?? 'UNDATED'}"
>
	<main>
		<article class="record">
			<div class="record-header">
				<span class="record-title">{data.post.title}</span>
				<span class="stamp">PUBLISHED</span>
			</div>
			<table class="spec-table">
				<tbody>
					<tr>
						<td class="label">FILED</td>
						<td>{data.post.publishedAt ?? 'undated'}</td>
					</tr>
					{#if data.post.authorName !== null}
						<tr>
							<td class="label">AUTHOR</td>
							<td>{data.post.authorName}</td>
						</tr>
					{/if}
					{#if data.post.tags.length > 0}
						<tr>
							<td class="label">TAGS</td>
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
			{#if cover !== null}
				<figure style="margin: 0 0 16px 0; border: 1px solid var(--border); padding: 3px;">
					<img
						src={cover}
						alt={data.post.title}
						style="width: 100%; display: block; filter: grayscale(35%) contrast(110%);"
					/>
				</figure>
			{/if}
			<!-- contentHtml is sanitized by the API render pipeline before storage. -->
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<div class="record-body">{@html data.post.contentHtml}</div>
		</article>

		{#if data.post.backlinks.length > 0}
			<section class="tool-section">
				<div class="section-banner">// LINKED MENTIONS</div>
				<table class="inventory-table">
					<thead>
						<tr>
							<th>REF</th>
							<th>RECORD</th>
							<th>LINK</th>
						</tr>
					</thead>
					<tbody>
						{#each data.post.backlinks as link, index (link.slug)}
							<tr>
								<td class="code">BK-{String(index + 1).padStart(2, '0')}</td>
								<td class="item">{link.title}</td>
								<td class="dim"><a href="/posts/{link.slug}">open →</a></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}
	</main>
</DocShell>
