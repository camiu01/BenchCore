<!-- @file +page.svelte @brief Identifier-only security history with bounded pagination. -->
<script lang="ts">
	import DocShell from '../../../lib/components/DocShell.svelte';
	import Seo from '../../../lib/components/Seo.svelte';
	import { t, currentLocale } from '../../../lib/i18n/t.svelte.js';
	import { publicationDate } from '../../../lib/presentation.js';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	const nav = $derived([
		{ href: '/admin', label: 'Admin' },
		{ href: '/account/security', label: t('security.title') }
	]);
</script>

<Seo
	title={t('security.audit')}
	description={t('security.auditHelp')}
	canonical="{data.siteBase}/admin/audit"
/>
<DocShell
	docId="FORM: BENCHCORE-2026 // REF: AUDIT"
	title={t('security.audit')}
	sub={t('security.auditHelp')}
	{nav}
	footerLeft="BenchCore"
	footerRight={t('security.audit')}
>
	<main>
		{#if !data.online}<p class="error-stamp" role="alert">{t('security.offline')}</p>{/if}
		{#each data.items as event (event.id)}
			<article class="record">
				<div class="record-header">
					<h2>{event.action}</h2>
					<span class="stamp">{event.count}</span>
				</div>
				<dl class="audit-details">
					<dt>{t('security.auditTime')}</dt>
					<dd>
						<time datetime={event.createdAt}
							>{publicationDate(event.createdAt, currentLocale())}</time
						>
					</dd>
					<dt>{t('security.auditActor')}</dt>
					<dd>{event.actorId ?? t('security.operator')}</dd>
					<dt>{t('security.auditTarget')}</dt>
					<dd>{event.targetId ?? '—'}</dd>
				</dl>
			</article>
		{:else}
			{#if data.online}<p class="summary">{t('security.auditEmpty')}</p>{/if}
		{/each}
		<nav class="btn-row" aria-label={t('security.audit')}>
			{#if data.offset > 0}<a class="btn" href="/admin/audit?offset={Math.max(0, data.offset - 50)}"
					>{t('security.previous')}</a
				>{/if}
			{#if data.hasMore && data.offset <= 99950}<a
					class="btn"
					href="/admin/audit?offset={data.offset + 50}">{t('security.next')}</a
				>{/if}
		</nav>
	</main>
</DocShell>

<style>
	.audit-details {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 8px 16px;
	}
	.audit-details dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	@media (max-width: 640px) {
		.audit-details {
			grid-template-columns: 1fr;
		}
	}
</style>
