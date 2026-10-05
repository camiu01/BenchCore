<!-- @file +page.svelte @brief Public form for choosing a password from a recovery link. -->
<script lang="ts">
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	const nav = [
		{ href: '/login', label: '[01] login' },
		{ href: '/', label: '[02] index' }
	];
</script>

<Seo
	title="Reset password | BenchCore"
	description="Choose a new account password."
	canonical="{data.siteBase}/reset-password"
/>
<DocShell
	docId="FORM: BENCHCORE-2026 // REF: RESET"
	title="RESET PASSWORD"
	sub="Choose a new password. All existing sessions will be revoked."
	{nav}
	footerLeft="AUTH: RECOVERY"
	footerRight="PASSWORD: SCRYPT"
>
	<main>
		<article class="record">
			<div class="record-header"><span class="record-title">NEW CREDENTIALS</span></div>
			{#if form?.error}<p class="error-stamp" role="alert">{form.error}</p>{/if}
			{#if data.token}
				<form method="POST" class="form-grid">
					<input type="hidden" name="token" value={data.token} />
					<label class="field-label" for="newPassword">New password, 8+ characters</label>
					<input
						class="field-input"
						id="newPassword"
						name="newPassword"
						type="password"
						required
						minlength="8"
						maxlength="200"
						autocomplete="new-password"
					/>
					<label class="field-label" for="confirmation">Confirm new password</label>
					<input
						class="field-input"
						id="confirmation"
						name="confirmation"
						type="password"
						required
						minlength="8"
						maxlength="200"
						autocomplete="new-password"
					/>
					<div class="btn-row">
						<button class="btn btn-accent" type="submit">RESET PASSWORD</button>
					</div>
				</form>
			{:else}
				<p class="error-stamp" role="alert">This reset link is invalid. Request a new one.</p>
				<a class="btn" href="/forgot-password">REQUEST NEW LINK</a>
			{/if}
		</article>
	</main>
</DocShell>
