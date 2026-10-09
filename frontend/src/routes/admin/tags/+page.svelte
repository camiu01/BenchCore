<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import DocShell from '../../../lib/components/DocShell.svelte';
	import Seo from '../../../lib/components/Seo.svelte';
	import TagColorEditor from '../../../lib/components/TagColorEditor.svelte';
	import TagChip from '../../../lib/components/TagChip.svelte';
	import { t } from '../../../lib/i18n/t.svelte.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const nav = $derived([
		{ href: '/admin', label: `[01] ${t('admin.nav.deck')}` },
		{ href: '/admin/posts/new', label: `[02] ${t('admin.nav.newRecord')}` },
		{ href: '/', label: `[03] ${t('admin.nav.index')}` }
	]);
</script>

<Seo
	title={t('admin.tags.title')}
	description={t('admin.tags.description')}
	canonical="{data.siteBase}/admin/tags"
/>

<DocShell
	docId="FORM: BENCHCORE-2026 // REF: TAGS"
	title={t('admin.tags.heading')}
	sub={t('admin.tags.sub')}
	{nav}
	footerLeft={t('admin.tags.count', { count: data.items.length })}
	footerRight={data.online ? t('admin.api.linked') : t('admin.api.offline')}
	activeHref="/admin/tags"
	wide
>
	<main>
		{#if data.notice}<p class="summary" role="status">{data.notice}</p>{/if}
		{#if form?.error}<p class="error-stamp" role="alert">{form.error}</p>{/if}
		{#if !data.online}
			<p class="error-stamp" role="alert">{t('admin.tags.unavailable')}</p>
			<a class="btn" href="/admin/tags">{t('admin.tags.retry')}</a>
		{:else if data.items.length === 0}
			<p class="summary">{t('admin.tags.empty')}</p>
			<a class="btn" href="/admin/posts/new">{t('admin.tags.createPost')}</a>
		{:else}
			<table class="inventory-table">
				<thead>
					<tr>
						<th>{t('admin.tags.colTag')}</th>
						<th>{t('admin.tags.colSlug')}</th>
						<th>{t('admin.tags.colRecords')}</th>
						<th>{t('admin.tags.colColor')}</th>
						<th>{t('admin.tags.colActions')}</th>
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
										if (!confirm(t('admin.tags.confirmDelete', { name: tag.name })))
											event.preventDefault();
									}}
								>
									<input type="hidden" name="id" value={tag.id} />
									<button class="btn danger" type="submit">{t('admin.tags.delete')}</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</main>
</DocShell>
