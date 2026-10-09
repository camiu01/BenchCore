<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import { postStatusKeys } from '../../../../lib/admin-posts.js';
	import type { ActionData, PageData } from './$types';
	import DocShell from '../../../../lib/components/DocShell.svelte';
	import PostEditor from '../../../../lib/components/PostEditor.svelte';
	import Seo from '../../../../lib/components/Seo.svelte';
	import { t } from '../../../../lib/i18n/t.svelte.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const nav = $derived([
		{ href: '/admin', label: `[01] ${t('admin.nav.deck')}` },
		{ href: '/admin/posts/new', label: `[02] ${t('admin.nav.newRecord')}` },
		{ href: '/admin/tags', label: `[03] ${t('admin.nav.tags')}` }
	]);
	const statusLabel = $derived(t(postStatusKeys[data.status]).toUpperCase());

	const values = $derived(form?.values ?? data.values);
	const previewHtml = $derived(form?.previewHtml ?? data.previewHtml);
	const uploadedUrl = $derived(form?.uploadedUrl ?? data.uploadedUrl);
	const errorMsg = $derived(form?.error ?? null);
</script>

<Seo
	title={t('admin.edit.title')}
	description={t('admin.edit.description')}
	canonical="{data.siteBase}/admin"
/>

<DocShell
	docId="FORM: BENCHCORE-2026 // REF: EDIT"
	title={t('admin.edit.heading')}
	sub={t('admin.edit.sub')}
	{nav}
	footerLeft={t('admin.edit.status', { status: statusLabel })}
	footerRight={t('admin.edit.autosave')}
>
	<main>
		<article class="record">
			<div class="record-header">
				<span class="record-title"
					>{t('admin.edit.recordTitle', { slug: values.slug || t('admin.edit.unsaved') })}</span
				>
				<span class="stamp">{statusLabel}</span>
			</div>
			<PostEditor
				{values}
				savedValues={data.values}
				{previewHtml}
				{uploadedUrl}
				{errorMsg}
				isNew={false}
				directUploads={data.directUploads}
				schedulerEnabled={data.schedulerEnabled}
				wikilinkSuggestions={data.wikilinkSuggestions}
			/>
		</article>
	</main>
</DocShell>
