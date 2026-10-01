<script lang="ts">
	import type { ActionData } from './$types';
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import { siteBase } from '../../lib/site.js';

	let { form }: { form: ActionData } = $props();

	const nav = [
		{ href: '/', label: '[01] index' },
		{ href: '/posts', label: '[02] records' },
		{ href: '/tags', label: '[03] tags' }
	];
</script>

<Seo
	title="Login — Engineering Log"
	description="Operator sign-in."
	canonical="{siteBase()}/login"
/>

<DocShell
	docId="FORM: BLOG-2026 // REF: AUTH"
	title="OPERATOR LOGIN"
	sub="Session cookie, 30-day expiry. Seeded via ADMIN_EMAIL / ADMIN_PASSWORD."
	{nav}
	footerLeft="AUTH: SESSION"
	footerRight="HTTPONLY + LAX"
>
	<main>
		<article class="record">
			<div class="record-header">
				<span class="record-title">CREDENTIALS</span>
				<span class="stamp">SIGN IN</span>
			</div>
			{#if form?.error !== undefined}
				<span class="error-stamp">{form.error}</span>
			{/if}
			<form method="POST" action="?/login">
				<div class="form-grid">
					<div>
						<label class="field-label" for="email">Email</label>
						<input
							class="field-input"
							id="email"
							name="email"
							type="email"
							required
							autocomplete="username"
							value={form?.email ?? ''}
						/>
					</div>
					<div>
						<label class="field-label" for="password">Password</label>
						<input
							class="field-input"
							id="password"
							name="password"
							type="password"
							required
							autocomplete="current-password"
						/>
					</div>
				</div>
				<div class="btn-row">
					<button class="btn btn-accent" type="submit">SIGN IN →</button>
				</div>
			</form>
		</article>
	</main>
</DocShell>
