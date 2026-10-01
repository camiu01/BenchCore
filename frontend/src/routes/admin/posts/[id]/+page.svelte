<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import DocShell from '../../../../lib/components/DocShell.svelte';
	import PostEditor from '../../../../lib/components/PostEditor.svelte';
	import Seo from '../../../../lib/components/Seo.svelte';
	import { siteBase } from '../../../../lib/site.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const nav = [
		{ href: '/admin', label: '[01] deck' },
		{ href: '/admin/posts/new', label: '[02] new record' },
		{ href: '/admin/tags', label: '[03] tags' }
	];

	const values = $derived(form?.values ?? data.values);
	const previewHtml = $derived(form?.previewHtml ?? data.previewHtml);
	const uploadedUrl = $derived(form?.uploadedUrl ?? data.uploadedUrl);
	const errorMsg = $derived(form?.error ?? null);
</script>

<Seo
	title="Edit record — Admin"
	description="Edit a filed record."
	canonical="{siteBase()}/admin"
/>

<DocShell
	docId="FORM: BLOG-2026 // REF: EDIT"
	title="EDIT RECORD"
	sub="Write mode plus API-rendered read mode, Obsidian style."
	{nav}
	footerLeft="STATUS: {data.status.toUpperCase()}"
	footerRight="AUTOSAVE: OFF"
>
	<main>
		<article class="record">
			<div class="record-header">
				<span class="record-title">EDIT // {values.slug || 'UNSAVED'}</span>
				<span class="stamp">{data.status.toUpperCase()}</span>
			</div>
			<PostEditor {values} {previewHtml} {uploadedUrl} {errorMsg} isNew={false} />
		</article>
	</main>
</DocShell>
