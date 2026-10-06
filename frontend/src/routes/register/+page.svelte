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
	title="Register | BenchCore"
	description="Create a reader account."
	canonical="{data.siteBase}/register"
/>
<DocShell
	docId="FORM: BENCHCORE-2026 // REF: REGISTER"
	title="CREATE AN ACCOUNT"
	sub="Read members-only posts and join the conversation."
	{nav}
	footerLeft="ACCESS: READER"
	footerRight="8+ CHARACTER PASSWORD"
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
					pattern={'[a-zA-Z][a-zA-Z0-9_\\-]{2,31}'}
					autocomplete="username"
					aria-describedby="username-help"
					value={form?.username ?? ''}
				/>
				<p class="field-help" id="username-help">
					Use 3–32 letters, numbers, underscores or hyphens. Start with a letter.
				</p>
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
					minlength="8"
					maxlength="200"
					autocomplete="new-password"
					aria-describedby="password-help"
				/>
				<p class="field-help" id="password-help">
					Use at least 8 characters. Choose a password you do not use elsewhere.
				</p>
				<label class="field-label" for="confirmation">Confirm password</label>
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
					<button class="btn btn-accent" type="submit">Create account →</button>
					<a class="btn" href="/login">Already have an account? Sign in</a>
				</div>
			</form>
		</article>
	</main>
</DocShell>
