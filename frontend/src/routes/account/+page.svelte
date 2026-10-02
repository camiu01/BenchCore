<!-- @file +page.svelte @brief Authenticated profile and password rotation form. -->
<script lang="ts">
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	const nav = $derived([
		{ href: '/', label: '[01] index' },
		...(data.user.role === 'admin' ? [{ href: '/admin', label: '[02] admin' }] : [])
	]);
</script>

<Seo
	title="Account — BenchCore"
	description="Account security."
	canonical="{data.siteBase}/account"
/>
<DocShell
	docId="FORM: BENCHCORE-2026 // REF: ACCOUNT"
	title="ACCOUNT SECURITY"
	sub="{data.user.name} · {data.user.email} · {data.user.role}"
	{nav}
	footerLeft="SESSION: PRIVATE"
	footerRight="PASSWORD: SCRYPT"
>
	<main>
		<article class="record">
			<div class="record-header"><span class="record-title">CHANGE PASSWORD</span></div>
			<p class="summary">
				Changing your password signs out all sessions. Your current password is required.
			</p>
			{#if form?.error}<p class="error-stamp" role="alert">{form.error}</p>{/if}
			<form method="POST" action="?/password" class="form-grid">
				<label class="field-label" for="currentPassword">Current password</label>
				<input
					class="field-input"
					id="currentPassword"
					name="currentPassword"
					type="password"
					required
					maxlength="200"
					autocomplete="current-password"
				/>
				<label class="field-label" for="newPassword">New password, 12+ characters</label>
				<input
					class="field-input"
					id="newPassword"
					name="newPassword"
					type="password"
					required
					minlength="12"
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
					minlength="12"
					maxlength="200"
					autocomplete="new-password"
				/>
				<div class="btn-row">
					<button class="btn btn-accent" type="submit">CHANGE PASSWORD</button>
				</div>
			</form>
		</article>
		<form method="POST" action="/logout"><button class="btn" type="submit">SIGN OUT</button></form>
	</main>
</DocShell>
