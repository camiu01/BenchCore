<!-- @file +page.svelte @brief Public reader registration form. -->
<script lang="ts">
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import { t } from '../../lib/i18n/t.svelte.js';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	const nav = [
		{ href: '/', label: '[01] index' },
		{ href: '/login', label: '[02] login' }
	];
</script>

<Seo
	title={t('auth.register.seoTitle')}
	description={t('auth.register.seoDescription')}
	canonical="{data.siteBase}/register"
/>
<DocShell
	docId="FORM: BENCHCORE-2026 // REF: REGISTER"
	title={t('auth.register.title')}
	sub={t('auth.register.sub')}
	{nav}
	footerLeft={t('auth.register.footerLeft')}
	footerRight={t('auth.register.footerRight')}
>
	<main>
		<article class="record">
			{#if form?.error}<p class="error-stamp" role="alert">{form.error}</p>{/if}
			<form method="POST" action="?/register" class="form-grid">
				<label class="field-label" for="name">{t('auth.register.name')}</label>
				<input
					class="field-input"
					id="name"
					name="name"
					required
					maxlength="200"
					autocomplete="name"
					value={form?.name ?? ''}
				/>
				<label class="field-label" for="username">{t('auth.register.username')}</label>
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
					{t('auth.register.usernameHelp')}
				</p>
				<label class="field-label" for="email">{t('auth.register.email')}</label>
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
				<label class="field-label" for="password">{t('auth.register.password')}</label>
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
					{t('auth.register.passwordHelp')}
				</p>
				<label class="field-label" for="confirmation">{t('auth.register.confirmation')}</label>
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
					<button class="btn btn-accent" type="submit">{t('auth.register.submit')}</button>
					<a class="btn" href="/login">{t('auth.register.signIn')}</a>
				</div>
			</form>
		</article>
	</main>
</DocShell>
