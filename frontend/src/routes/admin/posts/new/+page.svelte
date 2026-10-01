<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import DocShell from '../../../../lib/components/DocShell.svelte';
	import PostEditor from '../../../../lib/components/PostEditor.svelte';
	import Seo from '../../../../lib/components/Seo.svelte';
	import { siteBase } from '../../../../lib/site.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const nav = [
		{ href: '/admin', label: '[01] deck' },
		{ href: '/admin/tags', label: '[02] tags' },
		{ href: '/', label: '[03] index' }
	];

	const values = $derived(form?.values ?? data.values);
	const previewHtml = $derived(form?.previewHtml ?? data.previewHtml);
	const uploadedUrl = $derived(form?.uploadedUrl ?? data.uploadedUrl);
	const errorMsg = $derived(form?.error ?? null);
</script>

<Seo
	title="New record — Admin"
	description="File a new record."
	canonical="{siteBase()}/admin/posts/new"
/>

<DocShell
	docId="FORM: BLOG-2026 // REF: NEW"
	title="NEW RECORD"
	sub="Markdown with [[wikilinks]], previewed through the API render pipeline."
	{nav}
	footerLeft="MODE: WRITE"
	footerRight="DRAFT DEFAULT"
>
	<main>
		<article class="record">
			<div class="record-header">
				<span class="record-title">EDIT // UNSAVED</span>
				<span class="stamp">DRAFT</span>
			</div>
			<PostEditor {values} {previewHtml} {uploadedUrl} {errorMsg} isNew={true} />
		</article>
	</main>
</DocShell>
