<!-- @file +page.svelte @brief Engineering-log page and presentation component. -->
<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import DocShell from '../../lib/components/DocShell.svelte';
	import Seo from '../../lib/components/Seo.svelte';
	import { t } from '../../lib/i18n/t.svelte.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let passwordVisible = $state(false);

	const nav = [
		{ href: '/', label: '[01] index' },
		{ href: '/posts', label: '[02] records' },
		{ href: '/tags', label: '[03] tags' }
	];
</script>

<Seo
	title={t('auth.login.seoTitle')}
	description={t('auth.login.seoDescription')}
	canonical="{data.siteBase}/login"
/>

<DocShell
	docId="FORM: BENCHCORE-2026 // REF: AUTH"
	title={t('auth.login.title')}
	sub={t('auth.login.sub')}
	{nav}
	footerLeft={t('auth.login.footerLeft')}
	footerRight={t('auth.login.footerRight')}
>
	<main>
		<article class="record">
			<div class="record-header">
				<span class="record-title">{t('auth.login.credentials')}</span>
				<span class="stamp">{t('auth.login.stamp')}</span>
			</div>
			{#if form?.error !== undefined}
				<p class="error-stamp" role="alert">{form.error}</p>
			{/if}
			{#if data.notice}<p class="summary" role="status">{data.notice}</p>{/if}
			<form method="POST" action="?/login">
				<input type="hidden" name="next" value={data.next ?? ''} />
				<div class="form-grid">
					<div>
						<label class="field-label" for="email">{t('auth.login.identifier')}</label>
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
						<label class="field-label" for="password">{t('auth.login.password')}</label>
						<div class="password-input">
							<input
								class="field-input"
								id="password"
								name="password"
								type={passwordVisible ? 'text' : 'password'}
								required
								autocomplete="current-password"
							/>
							<button
								class="password-toggle"
								type="button"
								aria-label={passwordVisible
									? t('auth.login.hidePassword')
									: t('auth.login.showPassword')}
								aria-pressed={passwordVisible}
								title={passwordVisible
									? t('auth.login.hidePassword')
									: t('auth.login.showPassword')}
								onclick={() => (passwordVisible = !passwordVisible)}
							>
								{#if passwordVisible}
									<svg viewBox="0 0 24 24" aria-hidden="true">
										<path
											d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.5 10.5 0 0112 4c5.5 0 9 6 9 6a16 16 0 01-2.2 2.8M6.6 6.6C4.3 8.1 3 10 3 10s3.5 6 9 6a9.8 9.8 0 004-.8"
										/>
									</svg>
								{:else}
									<svg viewBox="0 0 24 24" aria-hidden="true">
										<path d="M3 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
										<circle cx="12" cy="10" r="2.5" />
									</svg>
								{/if}
							</button>
						</div>
					</div>
				</div>
				<div class="btn-row">
					<button class="btn btn-accent" type="submit">{t('auth.login.submit')}</button>
					<a class="btn" href="/register">{t('auth.login.createReader')}</a>
					<a class="btn" href="/forgot-password">{t('auth.login.forgot')}</a>
				</div>
			</form>
		</article>
	</main>
</DocShell>
