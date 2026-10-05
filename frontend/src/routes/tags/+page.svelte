<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { PageData } from './$types';
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';

	let { data }: { data: PageData } = $props();

	const nav = [
		{ href: '/', label: '[01] index' },
		{ href: '/posts', label: '[02] records' },
		{ href: '/admin', label: '[03] admin' }
	];
</script>

<Seo
	title="Tags | BenchCore"
	description="Every tag in the archive with record counts."
	canonical="{data.siteBase}/tags"
/>

<DocShell
	docId="FORM: BENCHCORE-2026 // REF: TAGS"
	title="TAGS"
	sub="Every tag in the archive with record counts."
	{nav}
	footerLeft="TAGS: {data.items.length}"
	footerRight="INDEX COMPLETE"
>
	<main>
		{#if !data.online}
			<article class="record">
				<div class="record-header">
					<span class="record-title">UPLINK // NO CARRIER</span>
					<span class="stamp">API OFFLINE</span>
				</div>
				<p class="summary">Start the API with <code>pnpm dev:api</code>.</p>
			</article>
		{:else}
			<table class="inventory-table">
				<thead>
					<tr>
						<th>TAG</th>
						<th>SLUG</th>
						<th>RECORDS</th>
					</tr>
				</thead>
				<tbody>
					{#each data.items as tag (tag.slug)}
						<tr>
							<td class="item"><a href="/tags/{encodeURIComponent(tag.name)}">{tag.name}</a></td>
							<td class="code">{tag.slug}</td>
							<td class="dim">{tag.count}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</main>
</DocShell>
