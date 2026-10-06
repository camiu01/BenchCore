<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import DocShell from '../../../lib/components/DocShell.svelte';
	import Seo from '../../../lib/components/Seo.svelte';
	import TagColorEditor from '../../../lib/components/TagColorEditor.svelte';
	import TagChip from '../../../lib/components/TagChip.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const nav = [
		{ href: '/admin', label: '[01] deck' },
		{ href: '/admin/posts/new', label: '[02] new record' },
		{ href: '/', label: '[03] index' }
	];
</script>

<Seo
	title="Tags | BenchCore Admin"
	description="Tag catalog."
	canonical="{data.siteBase}/admin/tags"
/>

<DocShell
	docId="FORM: BENCHCORE-2026 // REF: TAGS"
	title="TAG REGISTRY"
	sub="Assign colors or delete tags. Deletion removes associations, never posts."
	{nav}
	footerLeft="TAGS: {data.items.length}"
	footerRight={data.online ? 'API: LINKED' : 'API: OFFLINE'}
	activeHref="/admin/tags"
	wide
>
	<main>
		{#if data.notice}<p class="summary" role="status">{data.notice}</p>{/if}
		{#if form?.error}<p class="error-stamp" role="alert">{form.error}</p>{/if}
		{#if !data.online}
			<p class="error-stamp" role="alert">Tags are temporarily unavailable.</p>
			<a class="btn" href="/admin/tags">Try again</a>
		{:else if data.items.length === 0}
			<p class="summary">No tags yet. Add tags while creating or editing a post.</p>
			<a class="btn" href="/admin/posts/new">Create a post</a>
		{:else}
			<table class="inventory-table">
				<thead>
					<tr>
						<th>TAG</th>
						<th>SLUG</th>
						<th>RECORDS</th>
						<th>COLOR</th>
						<th>ACTIONS</th>
					</tr>
				</thead>
				<tbody>
					{#each data.items as tag (tag.slug)}
						<tr>
							<td class="item">{tag.name}</td>
							<td class="code">{tag.slug}</td>
							<td class="dim">{tag.count}</td>
							<td><TagChip label={tag.color} color={tag.color} /></td>
							<td>
								<TagColorEditor id={tag.id} name={tag.name} color={tag.color} />
								<form
									method="POST"
									action="?/delete"
									onsubmit={(event) => {
										if (!confirm(`Delete "${tag.name}" from every post?`)) event.preventDefault();
									}}
								>
									<input type="hidden" name="id" value={tag.id} />
									<button class="btn danger" type="submit">DELETE</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</main>
</DocShell>
