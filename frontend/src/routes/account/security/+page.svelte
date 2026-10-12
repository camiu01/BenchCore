<!-- @file +page.svelte @brief Device sessions and private QR/manual administrator authenticator setup. -->
<script lang="ts">
	import DocShell from '../../../lib/components/DocShell.svelte';
	import Seo from '../../../lib/components/Seo.svelte';
	import AuthenticatorQr from '../../../lib/components/AuthenticatorQr.svelte';
	import { t } from '../../../lib/i18n/t.svelte.js';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	const nav = $derived([
		{ href: '/account', label: t('security.account') },
		...(data.user.role === 'admin' ? [{ href: '/admin', label: 'Admin' }] : [])
	]);
</script>

<Seo
	title={t('security.title')}
	description={t('security.description')}
	canonical="{data.siteBase}/account/security"
/>
<DocShell
	docId="FORM: BENCHCORE-2026 // REF: SECURITY"
	title={t('security.title')}
	sub={data.user.email}
	{nav}
	footerLeft="BenchCore"
	footerRight={t('security.account')}
>
	<main>
		{#if form?.error}<p class="error-stamp" role="alert">{form.error}</p>{/if}
		<article class="record">
			<h2>{t('security.logoutAll')}</h2>
			<p class="summary">{t('security.logoutHelp')}</p>
			<form method="POST" action="?/logoutAll">
				<button class="btn" type="submit">{t('security.logoutAll')}</button>
			</form>
		</article>
		{#if data.user.role === 'admin'}
			<article class="record">
				<div class="record-header">
					<h2>{t('security.totp')}</h2>
					{#if data.factor}<span class="stamp"
							>{t(data.factor.enabled ? 'security.enabled' : 'security.disabled')}</span
						>{/if}
				</div>
				<p class="summary">{t('security.totpHelp')}</p>
				{#if !data.factor}
					<p class="error-stamp" role="alert">{t('security.offline')}</p>
				{:else if !data.factor.available}
					<p class="summary">{t('security.unavailable')}</p>
				{:else if data.factor.enabled}
					<p class="field-help">{t('security.freshCode')}</p>
					<form method="POST" action="?/disable" class="form-grid">
						<label class="field-label" for="disable-password">{t('security.password')}</label>
						<input
							class="field-input"
							id="disable-password"
							name="password"
							type="password"
							required
							maxlength="200"
							autocomplete="current-password"
						/>
						<label class="field-label" for="disable-code">{t('security.code')}</label>
						<input
							class="field-input"
							id="disable-code"
							name="code"
							inputmode="numeric"
							pattern={'[0-9]{6}'}
							minlength="6"
							maxlength="6"
							required
							autocomplete="one-time-code"
						/>
						<div class="btn-row">
							<button class="btn" type="submit">{t('security.disable')}</button>
						</div>
					</form>
				{:else if form?.enrollment}
					<p class="summary">{t('security.setupHelp')}</p>
					<AuthenticatorQr qr={form.enrollment.qr} />
					<label class="field-label" for="setup-key">{t('security.manualKey')}</label>
					<input
						class="field-input"
						id="setup-key"
						value={form.enrollment.secret}
						readonly
						autocomplete="off"
					/>
					<form method="POST" action="?/enable" class="form-grid">
						<input type="hidden" name="ticket" value={form.enrollment.ticket} />
						<label class="field-label" for="enable-password">{t('security.password')}</label>
						<input
							class="field-input"
							id="enable-password"
							name="password"
							type="password"
							required
							maxlength="200"
							autocomplete="current-password"
						/>
						<label class="field-label" for="enable-code">{t('security.code')}</label>
						<input
							class="field-input"
							id="enable-code"
							name="code"
							inputmode="numeric"
							pattern={'[0-9]{6}'}
							minlength="6"
							maxlength="6"
							required
							autocomplete="one-time-code"
						/>
						<div class="btn-row">
							<button class="btn btn-accent" type="submit">{t('security.enable')}</button>
						</div>
					</form>
				{:else}
					<form method="POST" action="?/enroll" class="form-grid">
						<label class="field-label" for="enroll-password">{t('security.password')}</label>
						<input
							class="field-input"
							id="enroll-password"
							name="password"
							type="password"
							required
							maxlength="200"
							autocomplete="current-password"
						/>
						<div class="btn-row">
							<button class="btn btn-accent" type="submit">{t('security.enroll')}</button>
						</div>
					</form>
				{/if}
			</article>
		{/if}
	</main>
</DocShell>
