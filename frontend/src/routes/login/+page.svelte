<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const nav = [
		{ href: '/', label: '[01] index' },
		{ href: '/posts', label: '[02] records' },
		{ href: '/tags', label: '[03] tags' }
	];
</script>

<Seo title="Login — BenchCore" description="Operator sign-in." canonical="{data.siteBase}/login" />

<DocShell
	docId="FORM: BENCHCORE-2026 // REF: AUTH"
	title="ACCOUNT LOGIN"
	sub="Username or email. Session cookie, 30-day expiry."
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
						<label class="field-label" for="email">Username or email</label>
						<input
							class="field-input"
							id="email"
							name="email"
							type="text"
							maxlength="254"
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
					<a class="btn" href="/register">CREATE READER ACCOUNT</a>
				</div>
			</form>
		</article>
	</main>
</DocShell>
