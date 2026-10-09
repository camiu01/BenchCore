<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import DocShell from '../../../../lib/components/DocShell.svelte';
	import PostEditor from '../../../../lib/components/PostEditor.svelte';
	import Seo from '../../../../lib/components/Seo.svelte';
	import { t } from '../../../../lib/i18n/t.svelte.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const nav = $derived([
		{ href: '/admin', label: `[01] ${t('admin.nav.deck')}` },
		{ href: '/admin/tags', label: `[02] ${t('admin.nav.tags')}` },
		{ href: '/', label: `[03] ${t('admin.nav.index')}` }
	]);

	const values = $derived(form?.values ?? data.values);
	const previewHtml = $derived(form?.previewHtml ?? data.previewHtml);
	const uploadedUrl = $derived(form?.uploadedUrl ?? data.uploadedUrl);
	const errorMsg = $derived(form?.error ?? null);
</script>

<Seo
	title={t('admin.new.title')}
	description={t('admin.new.description')}
	canonical="{data.siteBase}/admin/posts/new"
/>

<DocShell
	docId="FORM: BENCHCORE-2026 // REF: NEW"
	title={t('admin.new.heading')}
	sub={t('admin.new.sub')}
	{nav}
	footerLeft={t('admin.new.footerLeft')}
	footerRight={t('admin.new.footerRight')}
>
	<main>
		<article class="record">
			<div class="record-header">
				<span class="record-title">{t('admin.new.recordTitle')}</span>
				<span class="stamp">{t('admin.new.stamp')}</span>
			</div>
			<PostEditor
				{values}
				savedValues={data.values}
				{previewHtml}
				{uploadedUrl}
				{errorMsg}
				isNew={true}
				directUploads={data.directUploads}
				schedulerEnabled={data.schedulerEnabled}
				wikilinkSuggestions={data.wikilinkSuggestions}
			/>
		</article>
	</main>
</DocShell>
