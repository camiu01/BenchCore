<!-- @file +page.svelte @brief Administrator user ledger and explicit account controls. -->
<script lang="ts">
	import DocShell from '../../../lib/components/DocShell.svelte';
	import Seo from '../../../lib/components/Seo.svelte';
	import { t } from '../../../lib/i18n/t.svelte.js';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	const nav = $derived([
		{ href: '/admin', label: `[01] ${t('admin.nav.admin')}` },
		{ href: '/account', label: `[02] ${t('admin.nav.accountSecurity')}` }
	]);
</script>

<Seo
	title={t('admin.users.title')}
	description={t('admin.users.description')}
	canonical="{data.siteBase}/admin/users"
/>
<DocShell
	docId="FORM: BENCHCORE-2026 // REF: USERS"
	title={t('admin.users.heading')}
	sub={t('admin.users.sub')}
	{nav}
	footerLeft={t('admin.users.count', { count: data.total })}
	footerRight={data.online ? t('admin.api.linked') : t('admin.api.offline')}
>
	<main>
		{#if form?.error}<p class="error-stamp" role="alert">{form.error}</p>{/if}
		{#if !data.online}<p class="error-stamp" role="alert">{t('admin.users.unavailable')}</p>
			<a class="btn" href="/admin/users">{t('admin.users.retry')}</a>{/if}
		{#each data.items as account (account.id)}
			<article class="record">
				<div class="record-header">
					<span class="record-title">{account.name}</span><span class="stamp"
						>{account.isActive ? t('admin.users.active') : t('admin.users.disabled')}</span
					>
				</div>
				<p class="summary">
					{account.username ?? t('admin.users.emailLogin')} · {account.email} · {account.createdAt.slice(
						0,
						10
					)}
				</p>
				<form method="POST" action="?/update" class="form-grid">
					<input type="hidden" name="id" value={account.id} />
					<label class="field-label" for="role-{account.id}">{t('admin.users.role')}</label>
					<select class="field-input" id="role-{account.id}" name="role" value={account.role}>
						<option value="reader">{t('admin.users.reader')}</option><option value="admin"
							>{t('admin.users.administrator')}</option
						>
						{#if account.role === 'editor'}<option value="editor" disabled
								>{t('admin.users.legacyEditor')}</option
							>{/if}
					</select>
					<label class="field-label" for="active-{account.id}"
						>{t('admin.users.accountState')}</label
					>
					<select
						class="field-input"
						id="active-{account.id}"
						name="isActive"
						value={String(account.isActive)}
					>
						<option value="true">{t('admin.users.stateActive')}</option><option value="false"
							>{t('admin.users.stateDisabled')}</option
						>
					</select>
					<div class="btn-row">
						<button class="btn" type="submit">{t('admin.users.apply')}</button>
					</div>
				</form>
			</article>
		{/each}
		<nav class="btn-row" aria-label={t('admin.users.pages')}>
			{#if data.offset > 0}<a class="btn" href="/admin/users?offset={Math.max(0, data.offset - 25)}"
					>{t('admin.users.previous')}</a
				>{/if}
			{#if data.offset + 25 < data.total}<a
					class="btn"
					href="/admin/users?offset={data.offset + 25}">{t('admin.users.next')}</a
				>{/if}
		</nav>
		<article class="record">
			<div class="record-header">
				<span class="record-title">{t('admin.users.createTitle')}</span>
			</div>
			<form method="POST" action="?/create" class="form-grid">
				<label class="field-label" for="newName">{t('admin.users.displayName')}</label>
				<input
					class="field-input"
					id="newName"
					name="name"
					required
					maxlength="200"
					autocomplete="off"
				/>
				<label class="field-label" for="newUsername">{t('admin.users.username')}</label>
				<input
					class="field-input"
					id="newUsername"
					name="username"
					required
					minlength="3"
					maxlength="32"
					autocomplete="off"
				/>
				<label class="field-label" for="newEmail">{t('admin.users.email')}</label>
				<input
					class="field-input"
					id="newEmail"
					name="email"
					type="email"
					required
					maxlength="254"
					autocomplete="off"
				/>
				<label class="field-label" for="newPassword">{t('admin.users.tempPassword')}</label>
				<input
					class="field-input"
					id="newPassword"
					name="password"
					type="password"
					required
					minlength="8"
					maxlength="200"
					autocomplete="new-password"
				/>
				<label class="field-label" for="newRole">{t('admin.users.role')}</label>
				<select class="field-input" id="newRole" name="role"
					><option value="reader">{t('admin.users.reader')}</option><option value="admin"
						>{t('admin.users.administrator')}</option
					></select
				>
				<div class="btn-row">
					<button class="btn btn-accent" type="submit">{t('admin.users.create')}</button>
				</div>
			</form>
		</article>
	</main>
</DocShell>
