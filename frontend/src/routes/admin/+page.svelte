<script lang="ts">
	import type { LayoutData, PageData } from './$types';
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import { siteBase } from '../../lib/site.js';

	let { data }: { data: PageData & LayoutData } = $props();

	const nav = [
		{ href: '/', label: '[01] index' },
		{ href: '/admin/posts/new', label: '[02] new record' },
		{ href: '/admin/tags', label: '[03] tags' }
	];
</script>

<Seo
	title="Admin — Engineering Log"
	description="Operator dashboard."
	canonical="{siteBase()}/admin"
/>

<DocShell
	docId="FORM: BLOG-2026 // REF: ADMIN"
	title="OPERATOR DECK"
	sub="Signed in as {data.user?.email ?? 'unknown'} ({data.user?.role ?? 'none'})."
	{nav}
	footerLeft="RECORDS: {data.total}"
	footerRight={data.online ? 'API: LINKED' : 'API: OFFLINE'}
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
						<th>TITLE</th>
						<th>STATUS</th>
						<th>UPDATED</th>
						<th>EDIT</th>
					</tr>
				</thead>
				<tbody>
					{#each data.items as post (post.id)}
						<tr>
							<td class="item">{post.title}</td>
							<td class="code">{post.status.toUpperCase()}</td>
							<td class="dim">{post.updatedAt.slice(0, 10)}</td>
							<td class="dim"><a href="/admin/posts/{post.id}">open →</a></td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
		<form method="POST" action="/logout" style="margin-top: 20px;">
			<button class="btn" type="submit">SIGN OUT</button>
		</form>
	</main>
</DocShell>
