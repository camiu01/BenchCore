<!-- @file +page.svelte @brief Authenticated profile and password rotation form. -->
<script lang="ts">
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import type { MessageKey } from '../../lib/i18n/translate.js';
	import { t } from '../../lib/i18n/t.svelte.js';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	const roleLabels: Record<string, MessageKey> = {
		admin: 'auth.role.admin',
		editor: 'auth.role.editor',
		reader: 'auth.role.reader'
	};
	const roleKey = $derived(roleLabels[data.user.role]);
	const roleName = $derived(roleKey === undefined ? data.user.role : t(roleKey));
	const nav = $derived([
		{ href: '/', label: '[01] index' },
		{ href: '/posts', label: 'Posts' },
		{ href: '/tags', label: 'Topics' },
		{ href: '/graph', label: 'Connections' },
		...(data.user.role === 'admin' ? [{ href: '/admin', label: '[02] admin' }] : [])
	]);
</script>

<Seo
	title={t('auth.account.seoTitle')}
	description={t('auth.account.seoDescription')}
	canonical="{data.siteBase}/account"
/>
<DocShell
	docId="FORM: BENCHCORE-2026 // REF: ACCOUNT"
	title={t('auth.account.title')}
	sub="{data.user.name} · {data.user.email} · {roleName}"
	{nav}
	footerLeft={t('auth.account.footerLeft')}
	footerRight={t('auth.account.footerRight')}
>
	<main>
		<article class="record">
			<div class="record-header"><span class="record-title">{t('auth.account.heading')}</span></div>
			<p class="summary">
				{t('auth.account.summary')}
			</p>
			{#if form?.error}<p class="error-stamp" role="alert">{form.error}</p>{/if}
			<form method="POST" action="?/password" class="form-grid">
				<label class="field-label" for="currentPassword">{t('auth.account.currentPassword')}</label>
				<input
					class="field-input"
					id="currentPassword"
					name="currentPassword"
					type="password"
					required
					maxlength="200"
					autocomplete="current-password"
				/>
				<label class="field-label" for="newPassword">{t('auth.account.newPassword')}</label>
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
				<label class="field-label" for="confirmation">{t('auth.account.confirmation')}</label>
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
					<button class="btn btn-accent" type="submit">{t('auth.account.submit')}</button>
				</div>
			</form>
		</article>
		<form method="POST" action="/logout">
			<button class="btn" type="submit">{t('auth.account.signOut')}</button>
		</form>
	</main>
</DocShell>
