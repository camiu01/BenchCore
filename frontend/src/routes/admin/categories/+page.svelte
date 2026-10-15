<!-- @file +page.svelte @brief Main category management, without deleting the assigned posts. -->
<script lang="ts">
	import DocShell from '../../../lib/components/DocShell.svelte';
	import { t } from '../../../lib/i18n/t.svelte.js';
	import type { PageData, ActionData } from './$types';
	let { data, form }: { data: PageData; form?: ActionData } = $props();
	const nav = $derived([{ href: '/admin', label: t('vault.back') }]);
</script>

<DocShell
	title={t('publishing.categories')}
	sub={t('publishing.categoryHelp')}
	{nav}
	docId="FORM: CATEGORIES"
	footerLeft="BenchCore"
	footerRight="Categories"
>
	<main>
		{#if form?.error}<p role="alert" class="error-stamp">{form.error}</p>{/if}
		{#if !data.online}<p role="alert">{t('publishing.failed')}</p>{/if}
		{#each data.items as category (category.name)}
			<article class="record">
				<h2>{category.name} <span class="stamp">{category.count}</span></h2>
				<a href="/posts?category={encodeURIComponent(category.name)}">{t('publishing.browse')}</a>
				<form method="POST" class="form-grid">
					<input type="hidden" name="name" value={category.name} />
					<label class="field-label" for="category-{category.name}">{t('publishing.rename')}</label>
					<input
						class="field-input"
						id="category-{category.name}"
						name="replacement"
						maxlength="80"
						value={category.name}
					/>
					<p class="field-help">{t('publishing.clearHelp')}</p>
					<label
						><input type="checkbox" name="confirm" value="yes" required />
						{t('publishing.confirm')}</label
					>
					<button class="btn" type="submit">{t('publishing.save')}</button>
				</form>
			</article>
		{:else}<p class="summary">{t('publishing.noCategories')}</p>{/each}
	</main>
</DocShell>
