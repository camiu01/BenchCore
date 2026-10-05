<!-- @file +page.svelte @brief Public password recovery request form. -->
<script lang="ts">
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	const nav = [{ href: '/login', label: '[01] login' }, { href: '/', label: '[02] index' }];
</script>

<Seo title="Recover password | BenchCore" description="Request a password reset link." canonical="{data.siteBase}/forgot-password" />
<DocShell
	docId="FORM: BENCHCORE-2026 // REF: RECOVERY"
	title="RECOVER PASSWORD"
	sub="Request a single-use link. It expires after one hour."
	{nav}
	footerLeft="AUTH: RECOVERY"
	footerRight="TOKEN: SINGLE USE"
>
	<main>
		<article class="record">
			<div class="record-header"><span class="record-title">EMAIL ADDRESS</span></div>
			{#if form?.error}<p class="error-stamp" role="alert">{form.error}</p>{/if}
			{#if form?.success}
				<p class="summary" role="status">If an active account uses that email, a reset link has been sent.</p>
			{:else}
				<form method="POST" class="form-grid">
					<label class="field-label" for="email">Account email</label>
					<input class="field-input" id="email" name="email" type="email" required maxlength="254"
						autocomplete="email" value={form?.email ?? ''} />
					<div class="btn-row"><button class="btn btn-accent" type="submit">SEND RESET LINK</button></div>
				</form>
			{/if}
		</article>
	</main>
</DocShell>
