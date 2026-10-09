<!-- @file ReaderGate.svelte @brief Obscured placeholder without protected text, with reader sign-in links. -->
<script lang="ts">
	import { t } from '../i18n/t.svelte.js';
	let { slug }: { slug: string } = $props();
</script>

<section class="reader-gate" aria-label={t('public.gate.aria')}>
	<div class="reader-placeholder" aria-hidden="true">
		<div></div>
		<div></div>
		<div></div>
	</div>
	<div class="reader-message">
		<strong>{t('public.readersOnly')}</strong>
		<p>{t('public.gate.body')}</p>
		<div class="btn-row">
			<a class="btn btn-accent" href="/login?next={encodeURIComponent(`/posts/${slug}`)}"
				>{t('public.gate.signIn')}</a
			>
			<a class="btn" href="/register">{t('public.gate.create')}</a>
		</div>
	</div>
</section>

<style>
	.reader-gate {
		position: relative;
		min-height: 180px;
		padding: 24px;
		margin: 16px 0;
		border: 1px solid var(--border-light);
		background: var(--card-bg);
	}
	.reader-placeholder {
		filter: blur(4px);
		opacity: 0.2;
		pointer-events: none;
	}
	.reader-placeholder div {
		height: 12px;
		background: var(--muted);
		margin-bottom: 16px;
	}
	.reader-placeholder div:nth-child(2) {
		width: 80%;
	}
	.reader-placeholder div:nth-child(3) {
		width: 60%;
	}
	.reader-message {
		position: relative;
		margin-top: -64px;
	}
	.reader-message p {
		margin: 8px 0;
	}
</style>
