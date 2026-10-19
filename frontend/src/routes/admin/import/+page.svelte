<!-- @file +page.svelte @brief Obsidian vault import form with explicit audience and private-by-default access. -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import DocShell from '../../../lib/components/DocShell.svelte';
	import Seo from '../../../lib/components/Seo.svelte';
	import { t } from '../../../lib/i18n/t.svelte.js';
	import type { ActionData } from './$types';

	let { form = null }: { form?: ActionData } = $props();
	let busy = $state(false);
	const nav = $derived([{ href: '/admin', label: t('vault.back') }]);
</script>

<Seo title={t('vault.title')} description={t('vault.help')} type="website" noindex />

<DocShell
	docId="FORM: OBSIDIAN // REF: IMPORT"
	title={t('vault.title')}
	sub={t('vault.help')}
	{nav}
	activeHref="/admin/import"
	footerLeft="Obsidian → BenchCore"
	footerRight="Markdown / ZIP"
>
	<main>
		<article class="record">
			<h2>{t('vault.title')}</h2>
			<p class="summary">{t('vault.limits')}</p>
			<p class="field-help">{t('vault.attachments')}</p>
			<form
				method="POST"
				enctype="multipart/form-data"
				class="form-grid"
				use:enhance={() => {
					busy = true;
					return async ({ update }) => {
						try {
							await update({ reset: false });
						} finally {
							busy = false;
						}
					};
				}}
			>
				<label class="field-label" for="vault">{t('vault.file')}</label>
				<input
					class="field-input"
					id="vault"
					name="vault"
					type="file"
					accept=".zip,.md,application/zip,text/markdown"
					multiple
					aria-describedby="vault-selection-help"
					required
					disabled={busy}
				/>
				<p class="field-help" id="vault-selection-help">{t('vault.selectionHelp')}</p>
				<label class="field-label" for="visibility">{t('vault.visibility')}</label>
				<select class="field-input" id="visibility" name="visibility" disabled={busy}>
					<option value="private">{t('vault.private')}</option>
					<option value="readers">{t('vault.readers')}</option>
					<option value="public">{t('vault.public')}</option>
				</select>
				<p class="field-help" id="visibility-help">{t('vault.visibilityHelp')}</p>
				<label class="field-label">
					<input
						type="checkbox"
						name="confirm"
						value="yes"
						required
						disabled={busy}
						aria-describedby="visibility-help"
					/>
					{t('vault.confirm')}
				</label>
				<button class="btn btn-accent" type="submit" disabled={busy}>
					{busy ? t('vault.busy') : t('vault.submit')}
				</button>
			</form>
		</article>
		{#if form?.error}<p class="error-stamp" role="alert">{form.error}</p>{/if}
		{#if form?.result}
			<article class="record" aria-live="polite">
				<h2>{t('vault.result', { count: form.result.created.length })}</h2>
				<p class="summary">{t('vault.resultHelp')}</p>
				{#if form.result.errors.length}
					<h3>{t('vault.errors')}</h3>
					<ul>
						{#each form.result.errors as issue (issue)}<li>{issue.file}: {issue.message}</li>{/each}
					</ul>
				{/if}
				{#if form.result.warnings.length}
					<details>
						<summary>{t('vault.warnings', { count: form.result.warnings.length })}</summary>
						<ul>
							{#each form.result.warnings as issue (issue)}<li>
									{issue.file}: {issue.message}
								</li>{/each}
						</ul>
					</details>
				{/if}
				{#if form.result.skipped.length}
					<details>
						<summary>{t('vault.skipped', { count: form.result.skipped.length })}</summary>
						<ul>
							{#each form.result.skipped as path, index (index)}<li>{path}</li>{/each}
						</ul>
					</details>
				{/if}
				<a class="btn" href="/admin">{t('vault.back')}</a>
			</article>
		{/if}
	</main>
</DocShell>
