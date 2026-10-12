<!-- @file AuthenticatorQr.svelte @brief Theme-independent, accessible authenticator QR using locally encoded SVG geometry. -->
<script lang="ts">
	import type { TotpQrGraphic } from '../server/totp-qr.js';
	import { t } from '../i18n/t.svelte.js';

	let { qr }: { qr: TotpQrGraphic } = $props();
</script>

<figure class="authenticator-qr">
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 {qr.size} {qr.size}"
		width="224"
		height="224"
		role="img"
		aria-label={t('security.qrLabel')}
		shape-rendering="crispEdges"
	>
		<rect width={qr.size} height={qr.size} fill="#ffffff" />
		<path d={qr.path} fill="#000000" />
	</svg>
	<figcaption class="field-help">{t('security.qrHelp')}</figcaption>
</figure>

<style>
	.authenticator-qr {
		display: grid;
		justify-items: start;
		gap: 12px;
		margin: 16px 0;
	}
	svg {
		display: block;
		max-width: 100%;
		height: auto;
		border: 2px solid var(--border);
		background: #ffffff;
	}
	figcaption {
		max-width: 64ch;
		margin: 0;
	}
</style>
