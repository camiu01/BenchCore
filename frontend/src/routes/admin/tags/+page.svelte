<script lang="ts">
	import type { PageData } from './$types';
	import DocShell from '../../../lib/components/DocShell.svelte';
	import Seo from '../../../lib/components/Seo.svelte';
	import { siteBase } from '../../../lib/site.js';

	let { data }: { data: PageData } = $props();

	const nav = [
		{ href: '/admin', label: '[01] deck' },
		{ href: '/admin/posts/new', label: '[02] new record' },
		{ href: '/', label: '[03] index' }
	];
</script>

<Seo title="Tags — Admin" description="Tag catalog." canonical="{siteBase()}/admin/tags" />

<DocShell
	docId="FORM: BLOG-2026 // REF: TAGS"
	title="TAG REGISTRY"
	sub="Tags are filed from the record editor; empty tags vanish on save."
	{nav}
	footerLeft="TAGS: {data.items.length}"
	footerRight={data.online ? 'API: LINKED' : 'API: OFFLINE'}
>
	<main>
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
						<td class="item">{tag.name}</td>
						<td class="code">{tag.slug}</td>
						<td class="dim">{tag.count}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</main>
</DocShell>
