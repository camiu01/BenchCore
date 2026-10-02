<!-- @file +page.svelte @brief Public reader registration form. -->
<script lang="ts">
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	const nav = [
		{ href: '/', label: '[01] index' },
		{ href: '/login', label: '[02] login' }
	];
</script>

<Seo
	title="Register — BenchCore"
	description="Create a reader account."
	canonical="{data.siteBase}/register"
/>
<DocShell
	docId="FORM: BENCHCORE-2026 // REF: REGISTER"
	title="READER REGISTRATION"
	sub="Reader accounts cannot publish or manage users."
	{nav}
	footerLeft="ACCESS: READER"
	footerRight="12+ CHARACTER PASSWORD"
>
	<main>
		<article class="record">
			{#if form?.error}<p class="error-stamp" role="alert">{form.error}</p>{/if}
			<form method="POST" action="?/register" class="form-grid">
				<label class="field-label" for="name">Display name</label>
				<input
					class="field-input"
					id="name"
					name="name"
					required
					maxlength="200"
					autocomplete="name"
					value={form?.name ?? ''}
				/>
				<label class="field-label" for="username">Username</label>
				<input
					class="field-input"
					id="username"
					name="username"
					required
					minlength="3"
					maxlength="32"
					autocomplete="username"
					value={form?.username ?? ''}
				/>
				<label class="field-label" for="email">Email</label>
				<input
					class="field-input"
					id="email"
					name="email"
					type="email"
					required
					maxlength="254"
					autocomplete="email"
					value={form?.email ?? ''}
				/>
				<label class="field-label" for="password">Password</label>
				<input
					class="field-input"
					id="password"
					name="password"
					type="password"
					required
					minlength="12"
					maxlength="200"
					autocomplete="new-password"
				/>
				<label class="field-label" for="confirmation">Confirm password</label>
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
					<button class="btn btn-accent" type="submit">REGISTER READER →</button>
				</div>
			</form>
		</article>
	</main>
</DocShell>
